#!/usr/bin/env node
/**
 * Deleted-post recovery reliability patch for the macOS port.
 *
 * Fixes three upstream recovery issues observed in real-world testing:
 * 1. Do not binary-search a fake "total" from the feeds endpoint.
 * 2. Parse every <li> interaction row returned inside each feed HTML payload.
 * 3. Queue recovered post images for local download before SPA export.
 *
 * Upstream: salt-fishes/qzone-archiver v4.0.0 (Apache-2.0)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const upstreamRoot = path.resolve(process.argv[2] || '.');
const desktopDir = path.join(upstreamRoot, 'desktop');

function fail(message) {
  console.error(`[recovery-fix] ${message}`);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  console.log(`[recovery-fix] updated ${path.relative(upstreamRoot, file)}`);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail(`Could not locate start marker: ${label}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) fail(`Could not locate end marker: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) fail(`Could not locate patch marker: ${label}`);
  return source.replace(needle, replacement);
}

const messagesFile = path.join(desktopDir, 'src/engine/modules/messages.js');
let messagesSource = read(messagesFile);

const recoveryStart = 'API.Messages.getDeletedMessages = async(existingItems) => {';
const recoveryEnd = '\n\n\n/**\n * 获取说说的MD内容';

const recoveryReplacement = String.raw`API.Messages.getDeletedMessages = async(existingItems) => {
    existingItems = existingItems || [];
    const feedsConfig = QZone_Config.Messages.Feeds || {};

    // MODIFIED FOR macOS PORT:
    // The feeds endpoint can return one JSON "feed" object whose html contains
    // multiple <li> rows. It also does not expose a trustworthy total count.
    // Scan forward sequentially (like the original Python implementation)
    // until the endpoint becomes empty or starts repeating a page.
    const configuredPageSize = Number(feedsConfig.pageSize) || 10;
    const pageSize = Math.max(1, Math.min(10, configuredPageSize));
    const configuredMin = Number(feedsConfig.randomSeconds && feedsConfig.randomSeconds.min) || 0;
    const configuredMax = Number(feedsConfig.randomSeconds && feedsConfig.randomSeconds.max) || 0;
    const scanMinSec = Math.max(7, configuredMin);
    const scanMaxSec = Math.max(9, configuredMax, scanMinSec + 1);
    const maxPages = 5000;
    const maxPageAttempts = 5;

    const indicator = new StatusIndicator('Messages_Deleted');
    // Total is genuinely unknown while scanning. Keep the current-step bar at
    // 0% and use the status text/log for meaningful progress.
    indicator.setTotal(1);
    await indicator.setIndex(0);
    indicator.setNextTip('恢复已删除说说：正在扫描互动历史...');

    const existingTids = new Set(existingItems.map(m => m.tid).filter(Boolean));
    const existingContents = new Set(
        existingItems
            .map(m => (m.content || m.custom_content || '').replace(/\s+/g, ' ').trim().substring(0, 80))
            .filter(Boolean)
    );

    const aggregated = new Map();
    const seenPageFingerprints = new Set();
    let scannedRows = 0;
    let consecutiveEmptyPages = 0;
    let oldestTime = 0;
    let stoppedByError = false;
    let reachedSafetyLimit = true;

    const decodeFeedHtml = (htmlText) => {
        return String(htmlText || '')
            .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    };

    const normalizeImageUrl = (url) => {
        url = String(url || '').replace(/&amp;/g, '&').trim();
        if (!url) return '';
        try {
            return API.Utils.toHttps(url);
        } catch (_) {
            return url.replace(/^\/\//, 'https://');
        }
    };

    const expandFeedRows = (feed) => {
        if (!feed || !feed.html) return [];
        try {
            const html = decodeFeedHtml(feed.html);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            let rows = Array.from(doc.querySelectorAll('li.f-single.f-s-s'));
            if (!rows.length) rows = Array.from(doc.querySelectorAll('li.f-single'));
            if (!rows.length) rows = Array.from(doc.querySelectorAll('li'));
            if (!rows.length) return [{ ...feed, html: html }];
            return rows.map(row => ({ ...feed, html: row.outerHTML }));
        } catch (e) {
            console.warn('[recovery] 展开互动消息 HTML 失败，回退单条解析', e);
            return [feed];
        }
    };

    const extractRowImages = (htmlText) => {
        const urls = [];
        try {
            const doc = new DOMParser().parseFromString(decodeFeedHtml(htmlText), 'text/html');
            const nodes = doc.querySelectorAll(
                'a.img-item img, .img-item img, .img-box img, .pic-box img, .feed-img img'
            );
            for (const img of nodes) {
                const url = normalizeImageUrl(
                    img.getAttribute('src') ||
                    img.getAttribute('data-src') ||
                    img.getAttribute('data-original') ||
                    ''
                );
                if (url && !urls.includes(url)) urls.push(url);
            }
        } catch (_) {
            // A missing image is non-fatal; text recovery should continue.
        }
        return urls;
    };

    const pageFingerprint = (rows) => {
        // Small deterministic hash: enough to detect an endpoint that ignores
        // offset and keeps sending exactly the same page forever.
        let hash = 2166136261;
        const text = rows.map(r => String(r.html || '')).join('\u241e');
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16) + ':' + rows.length;
    };

    const aggregateParsed = (parsed, rowImages) => {
        if (!parsed) return;

        const normalizedContent = (parsed.content || '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 80);

        // Prefer the real QZone tid. When no tid survives in the notification,
        // content is the best stable fallback; this intentionally groups
        // multiple like/comment notifications for the same deleted post.
        const aggKey = parsed.origtid || normalizedContent;
        if (!aggKey) return;

        const imageUrls = [];
        if (parsed.imageUrl) imageUrls.push(normalizeImageUrl(parsed.imageUrl));
        for (const url of rowImages || []) {
            if (url && !imageUrls.includes(url)) imageUrls.push(url);
        }

        if (!aggregated.has(aggKey)) {
            aggregated.set(aggKey, {
                tid: parsed.origtid || '',
                abstime: parsed.abstime || 0,
                content: parsed.content || '',
                imageUrls: imageUrls.filter(Boolean),
                comments: [],
                likes: []
            });
        }

        const entry = aggregated.get(aggKey);
        if (!entry.content && parsed.content) entry.content = parsed.content;
        if (!entry.tid && parsed.origtid) entry.tid = parsed.origtid;

        for (const url of imageUrls) {
            if (url && !entry.imageUrls.includes(url)) entry.imageUrls.push(url);
        }

        if (parsed.feedType === 'comment' && parsed.commentContent) {
            entry.comments.push({
                content: parsed.commentContent,
                uin: parsed.operator && parsed.operator.uin,
                name: parsed.operator && parsed.operator.nickname,
                time: parsed.operator && parsed.operator.time
            });
        } else if (parsed.feedType === 'like') {
            entry.likes.push({
                fuin: parsed.operator && parsed.operator.uin,
                name: parsed.operator && parsed.operator.nickname,
                time: parsed.operator && parsed.operator.time
            });
        }

        // Keep the oldest known post timestamp for this aggregate.
        if (parsed.abstime && (!entry.abstime || parsed.abstime < entry.abstime)) {
            entry.abstime = parsed.abstime;
        }
        if (parsed.abstime && (!oldestTime || parsed.abstime < oldestTime)) {
            oldestTime = parsed.abstime;
        }
    };

    // Sequentially walk the interaction history. Unlike the previous binary
    // search, this never interprets "feeds.length === 1" as ten million rows.
    for (let page = 0; page < maxPages; page++) {
        await window.checkExportState();

        const offset = page * pageSize;
        let rawFeeds = null;
        let lastError = null;

        for (let attempt = 0; attempt < maxPageAttempts; attempt++) {
            try {
                const response = await API.Messages.getFeeds(offset, pageSize);
                const responseText = String(response || '');

                if (responseText.indexOf('waf.tencent.com') > -1) {
                    throw new Error('QQ 空间风控拦截了互动历史请求');
                }

                let data = null;
                try {
                    data = API.Utils.toJson(responseText, /^_Callback\(/);
                } catch (parseError) {
                    // Some historical responses are HTML-like instead of the
                    // newer JSON shape. Preserve the raw payload as one feed so
                    // expandFeedRows() can still extract every <li>.
                    if (/<li[\s>]/i.test(responseText)) {
                        rawFeeds = [{ html: responseText }];
                        break;
                    }
                    throw parseError;
                }

                if (data && data.code && data.code !== 0) {
                    const message = data.message || data.msg || ('code=' + data.code);
                    throw new Error('互动历史接口返回异常：' + message);
                }

                const payload = data && data.data;
                const feeds = payload && (payload.data || payload.feeds || payload.list);
                if (Array.isArray(feeds)) {
                    rawFeeds = feeds;
                } else if (feeds) {
                    rawFeeds = [feeds];
                } else if (payload && payload.html) {
                    rawFeeds = [payload];
                } else {
                    rawFeeds = [];
                }
                break;
            } catch (e) {
                lastError = e;
                if (attempt >= maxPageAttempts - 1) break;

                const waitSec = Math.min(90, 15 * Math.pow(2, attempt));
                indicator.setNextTip(
                    '第 ' + (page + 1) + ' 页请求受限，' + waitSec + ' 秒后重试（' +
                    (attempt + 1) + '/' + maxPageAttempts + '）'
                );
                console.warn('[recovery] 互动历史页重试', {
                    page: page + 1,
                    offset: offset,
                    attempt: attempt + 1,
                    waitSec: waitSec,
                    error: e && e.message
                });
                await API.Utils.sleep(waitSec * 1000);
            }
        }

        if (rawFeeds == null) {
            stoppedByError = true;
            indicator.setNextTip(
                '第 ' + (page + 1) + ' 页连续重试失败，已停止扫描；之前读取的数据仍会保存'
            );
            console.error('[recovery] 互动历史扫描停止', {
                page: page + 1,
                offset: offset,
                error: lastError
            });
            reachedSafetyLimit = false;
            break;
        }

        const rows = [];
        for (const feed of rawFeeds) {
            rows.push(...expandFeedRows(feed));
        }

        if (!rows.length) {
            consecutiveEmptyPages++;
            if (consecutiveEmptyPages >= 3) {
                indicator.setNextTip('互动历史已扫描到底，开始整理恢复结果...');
                reachedSafetyLimit = false;
                break;
            }
            await API.Utils.sleep(scanMinSec * 1000);
            continue;
        }
        consecutiveEmptyPages = 0;

        const fingerprint = pageFingerprint(rows);
        if (seenPageFingerprints.has(fingerprint)) {
            indicator.setNextTip('检测到互动历史开始重复，已到达可读取历史边界');
            reachedSafetyLimit = false;
            break;
        }
        seenPageFingerprints.add(fingerprint);

        let parsedOnPage = 0;
        for (const rowFeed of rows) {
            const parsed = API.Messages.parseFeedHtml(rowFeed.html, rowFeed);
            if (!parsed) continue;
            parsedOnPage++;
            aggregateParsed(parsed, extractRowImages(rowFeed.html));
        }
        scannedRows += parsedOnPage;

        if (page === 0 || (page + 1) % 5 === 0) {
            const oldestLabel = oldestTime
                ? API.Utils.formatDate(oldestTime, 'yyyy-MM-dd')
                : '未知';
            indicator.setNextTip(
                '扫描互动历史：已读取 ' + scannedRows +
                ' 条，聚合 ' + aggregated.size +
                ' 条相关内容，当前最早 ' + oldestLabel
            );
        }

        await API.Utils.sleep(
            API.Utils.randomSeconds(scanMinSec, scanMaxSec) * 1000
        );
    }

    if (reachedSafetyLimit) {
        console.warn('[recovery] 已达到安全页数上限', { maxPages: maxPages, scannedRows: scannedRows });
        indicator.setNextTip('已达到安全扫描上限，开始整理当前已读取的历史...');
    }

    console.info('[recovery] 互动历史扫描完成', {
        scannedRows: scannedRows,
        aggregated: aggregated.size,
        oldest: oldestTime ? API.Utils.formatDate(oldestTime) : '',
        stoppedByError: stoppedByError
    });

    const deletedCandidates = [];
    for (const entry of aggregated.values()) {
        if (entry.tid && existingTids.has(entry.tid)) continue;

        if (!entry.tid && entry.content) {
            const normalized = entry.content
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 80);
            if (existingContents.has(normalized)) continue;
        }
        deletedCandidates.push(entry);
    }

    // Oldest first makes it easy to verify whether the scan reached earlier years.
    deletedCandidates.sort((a, b) => (a.abstime || 0) - (b.abstime || 0));

    console.info('[recovery] 已删除说说候选', {
        candidates: deletedCandidates.length,
        aggregated: aggregated.size
    });

    if (!deletedCandidates.length) {
        indicator.setSuccess(0);
        indicator.setTotal(1);
        await indicator.setIndex(1);
        indicator.setNextTip('互动历史扫描完成，但未发现新的已删除说说候选');
        indicator.complete();
        return [];
    }

    // Candidate enrichment has a real total, so the step percentage becomes
    // meaningful again from here.
    indicator.setSuccess(0);
    indicator.setFailed(0);
    indicator.setSkip(0);
    indicator.setTotal(deletedCandidates.length);
    await indicator.setIndex(0);
    indicator.setNextTip(
        '发现 ' + deletedCandidates.length + ' 条已删除候选，正在补全详情、评论、点赞和图片...'
    );

    const result = [];

    for (let i = 0; i < deletedCandidates.length; i++) {
        const entry = deletedCandidates[i];
        await window.checkExportState();
        await indicator.setIndex(i);

        const contentSig = (entry.content || '').replace(/\s+/g, '').substring(0, 20);
        const finalTid = entry.tid || ('deleted_' + (entry.abstime || 0) + '_' + contentSig);

        const message = {
            tid: finalTid,
            isDeleted: true,
            created_time: entry.abstime || 0,
            custom_create_time: API.Utils.formatDate(entry.abstime || 0),
            content: entry.content || '',
            custom_content: entry.content || '',
            commentlist: [],
            custom_comments: [],
            commenttotal: 0,
            likes: [],
            likeTotal: 0,
            pic_list: [],
            custom_images: [],
            custom_videos: [],
            custom_audios: [],
            custom_magics: [],
            custom_voices: [],
            uniKey: API.Messages.getUniKey(finalTid)
        };

        // The detail endpoint may still retain a deleted post even if it no
        // longer appears in the normal list. Enrichment failure is non-fatal.
        if (entry.tid) {
            try {
                const detailResp = await API.Messages.getFullContent(entry.tid);
                const detailData = API.Utils.toJson(detailResp, /^_Callback\(/);
                if (detailData && (!detailData.code || detailData.code === 0)) {
                    if (detailData.content) {
                        message.content = detailData.content;
                        message.custom_content = detailData.content;
                    }
                    message.conlist = detailData.conlist || [];

                    if (detailData.created_time) {
                        message.created_time = detailData.created_time;
                        message.custom_create_time = API.Utils.formatDate(detailData.created_time);
                    }

                    if (Array.isArray(detailData.pic_list) && detailData.pic_list.length) {
                        message.pic_list = detailData.pic_list;
                        message.custom_images = detailData.pic_list.map(pic => {
                            const url = normalizeImageUrl(
                                pic.custom_url || pic.url2 || pic.url1 || pic.url3 ||
                                pic.b_url || pic.s_url || pic.url || ''
                            );
                            return {
                                ...pic,
                                custom_url: url || pic.custom_url || '',
                                url1: url || pic.url1 || '',
                                url2: url || pic.url2 || url || '',
                                url3: url || pic.url3 || url || '',
                                is_video: !!pic.is_video
                            };
                        });
                    }
                }
            } catch (e) {
                console.debug('[recovery] 已删除说说详情不可用，保留互动通知摘要', entry.tid);
            }
        }

        // If the deleted detail endpoint no longer has pictures, preserve every
        // thumbnail/image URL still present in the interaction notification.
        if (!message.custom_images.length && entry.imageUrls && entry.imageUrls.length) {
            message.custom_images = entry.imageUrls
                .map(normalizeImageUrl)
                .filter(Boolean)
                .map(url => ({
                    custom_url: url,
                    url1: url,
                    url2: url,
                    url3: url,
                    is_video: false
                }));
        }

        if (entry.tid) {
            try {
                const comments = await API.Messages.getItemCommentList({ tid: entry.tid }, 0);
                if (comments && comments.length) {
                    message.commentlist = comments;
                    message.custom_comments = comments;
                    message.commenttotal = comments.length;
                }
            } catch (_) {
                // Fall back to notification-derived comments below.
            }
        }

        if (!message.custom_comments.length && entry.comments.length) {
            message.commentlist = entry.comments.map(c => ({
                content: c.content,
                uin: c.uin,
                name: c.name,
                create_time: c.time,
                custom_create_time: API.Utils.formatDate(c.time)
            }));
            message.custom_comments = message.commentlist;
            message.commenttotal = message.commentlist.length;
        }

        if (API.Common.isGetLike(QZone_Config.Messages) && entry.tid) {
            try {
                const likeItem = { uniKey: message.uniKey, likes: [] };
                await API.Common.getModulesLikeList(likeItem, QZone_Config.Messages);
                if (likeItem.likes && likeItem.likes.length) {
                    message.likes = likeItem.likes;
                }
            } catch (_) {
                // Fall back to notification-derived likes below.
            }
        }

        if (!message.likes.length && entry.likes.length) {
            message.likes = entry.likes;
        }
        message.likeTotal = message.likes.length;

        result.push(message);
        indicator.addSuccess(message);

        // Enrichment requests are slower than local parsing; keep a modest
        // delay to avoid turning a complete scan into a new WAF trigger.
        await API.Utils.sleep(
            API.Utils.randomSeconds(Math.max(2, configuredMin), Math.max(4, configuredMax)) * 1000
        );
    }

    console.info('[recovery] 已删除说说恢复完成', {
        count: result.length,
        oldest: result.length ? result[0].custom_create_time : ''
    });

    indicator.nextTip = '';
    indicator.complete();
    return result;
}`;

messagesSource = replaceSection(
  messagesSource,
  recoveryStart,
  recoveryEnd,
  recoveryReplacement,
  'API.Messages.getDeletedMessages',
);
write(messagesFile, messagesSource);

// Recovered items used to be written to SPA data immediately. Normal messages
// had already passed addMediaToTasks(), but deleted messages had not, leaving
// only expiring/hotlink-protected QQ URLs. Queue recovered media first so the
// export points at local files whenever the source is still downloadable.
const exporterFile = path.join(desktopDir, 'src/engine/exporters/messages.js');
let exporterSource = read(exporterFile);

exporterSource = replaceOnce(
  exporterSource,
  `                deletedItems = await API.Messages.getDeletedMessages(messages);
                if (deletedItems.length > 0) {
                    await API.Common.writeJsonToJs(`,
  `                deletedItems = await API.Messages.getDeletedMessages(messages);
                if (deletedItems.length > 0) {
                    try {
                        console.info('[recovery] 正在把恢复说说的图片保存到本地', { count: deletedItems.length });
                        await API.Messages.addMediaToTasks(deletedItems);
                    } catch (mediaError) {
                        // Image localization failure must not discard recovered text.
                        console.warn('[recovery] 部分恢复图片无法保存，本次仍会导出文字和可用远程链接', mediaError);
                    }
                    await API.Common.writeJsonToJs(`,
  'recovered-media localization',
);

write(exporterFile, exporterSource);

console.log('[recovery-fix] deleted-post recovery reliability patch applied');
