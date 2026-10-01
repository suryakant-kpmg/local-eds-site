/*
 * Product feed for listing blocks (cards-nilaya, cards-popular).
 * Each of those blocks carries its own identical copy of this file, so a block folder can be
 * copied to another project on its own. Keep the copies identical.
 *
 * The feed is loaded once per page and shared (also between the copies). Its URL is the page
 * metadata `product-feed`, or by convention /data/products/<page path>.json (kept fresh by
 * tools/sync/product-feed.mjs). Two shapes are understood, so the source can change without
 * touching the blocks:
 *   - the EDS sheet written by the sync ({ data: [{ code, name, brand, url, image, badge,
 *     features, price, popularity, popular }] })
 *   - the Asian Paints listing JSON itself (a list of { productCode, productName, brandName,
 *     pageUrl, productPackshotImage, featuredTag, visibleTags, livePrice, popularity }), e.g. from
 *     a future Asian Paints API: set `product-feed` to its URL; optional `product-feed-popular`
 *     lists the popular product codes in order.
 * Returns null (blocks keep their authored tiles) when there is no feed, it fails or it is slow.
 */
import { getMetadata } from '../../scripts/aem.js';

const TIMEOUT = 2500;

const SITE = 'https://www.asianpaints.com';

export const productKey = (href) => {
  try {
    const { pathname } = new URL(href, SITE);
    return pathname.replace(/\.html$/, '').replace(/\/$/, '').toLowerCase();
  } catch (e) {
    return '';
  }
};

function normalize(record, popularCodes) {
  const code = record.code ?? record.productCode ?? '';
  const features = Array.isArray(record.visibleTags)
    ? record.visibleTags
    : String(record.features || '').split('|');
  let popular = Number(record.popular) || 0;
  if (!popular && popularCodes.length) popular = popularCodes.indexOf(code) + 1;
  const image = record.image ?? record.productPackshotImage ?? '';
  return {
    code,
    name: String(record.name ?? record.productName ?? '').trim(),
    brand: record.brand ?? record.brandName ?? '',
    url: record.url ?? record.pageUrl ?? '',
    image: image ? new URL(image, SITE).href : '',
    badge: record.badge ?? record.featuredTag ?? '',
    features: features.map((feature) => feature.trim()).filter(Boolean),
    price: String(record.price ?? record.livePrice ?? ''),
    popularity: Number(record.popularity) || 99,
    popular,
  };
}

async function load() {
  const url = getMetadata('product-feed')
    || `${window.hlx?.codeBasePath || ''}/data/products${window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '')}.json`;
  const popularCodes = getMetadata('product-feed-popular').split(',').map((code) => code.trim()).filter(Boolean);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const json = await response.json();
    const records = Array.isArray(json) ? json : json.data;
    if (!Array.isArray(records)) return null;
    const products = records.map((record) => normalize(record, popularCodes))
      .filter((product) => product.name && product.url);
    return products.length ? products : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** @returns {Promise<object[]|null>} The page's products, or null to keep the authored tiles */
export default function loadProductFeed() {
  // shared on window so both blocks' copies load the feed once per page
  if (!window.productFeed) window.productFeed = load();
  return window.productFeed;
}
