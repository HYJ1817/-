/*
 * 123pan iOS App QX ad cleanup
 *
 * Best-effort strategy:
 * - force the built-in ad switch off where it exists
 * - strip known share-page promo backgrounds / image slots
 * - spoof the minimal VIP flag on user-info payloads only
 * - keep away from download unlocking / payment logic
 */

function safeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function clearShareBackground(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map((item) => {
    if (!isObject(item)) {
      return item;
    }

    item.viewImg = "";
    item.viewUrl = "";
    item.payImg = "";
    item.payUrl = "";
    item.fileImg = "";
    item.fileUrl = "";
    return item;
  });
}

function sanitizeNode(node) {
  if (Array.isArray(node)) {
    return node.map(sanitizeNode);
  }

  if (!isObject(node)) {
    return node;
  }

  for (const key of Object.keys(node)) {
    const value = node[key];

    if (key === "IsShowAdvertisement") {
      node[key] = false;
      continue;
    }

    if (key === "shareBackground") {
      node[key] = clearShareBackground(value);
      continue;
    }

    if (key === "BackendImgUrl" || key === "backgroundImgUrl" || key === "backgroundUrl") {
      node[key] = "";
      continue;
    }

    if (/^(?:adList|advertisementList|bannerList|popupList|activityList|promotionList)$/i.test(key)) {
      node[key] = [];
      continue;
    }

    node[key] = sanitizeNode(value);
  }

  return node;
}

function spoofUserInfo(data) {
  if (!isObject(data)) {
    return data;
  }

  data.IsShowAdvertisement = false;
  data.Vip = true;
  data.VipLevel = Math.max(safeNumber(data.VipLevel, 0), 2);
  data.VipExpire = data.VipExpire || "2099-12-31 23:59:59";

  if (isObject(data.UserVipDetail)) {
    data.UserVipDetail.VipCode = Math.max(safeNumber(data.UserVipDetail.VipCode, 0), 2);
  }

  return data;
}

let body = $response.body;

try {
  const url = new URL($request.url);
  const path = url.pathname;
  const obj = JSON.parse(body);

  sanitizeNode(obj);

  if (/\/(?:b\/)?api\/user\/info$/i.test(path) && isObject(obj.data)) {
    obj.data = spoofUserInfo(obj.data);
  }

  body = JSON.stringify(obj);
} catch (error) {
  console.log("123pan-qx-adblock parse failed: " + error);
}

$done({ body });
