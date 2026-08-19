
const https = require('https');

const candidates = [
  // 1. 基于“云阶” (Yunjie) 直接做母公司矩阵 (最统一，无任何多余概念)
  'yunjielabs.com',
  'yunjieworks.com',
  'yunjiestudio.com',
  'yunjienexus.com',
  'yunjiecraft.com',
  'yunjiedigital.com',
  'yunjiepulse.com',

  // 2. “拓界” (Tuojie - 拓宽边界，适合AI、游戏、科技开拓)
  'tuojielabs.com',
  'tuojietech.com',
  'tuojieworks.com',
  'tuojiedigital.com',

  // 3. “曜界 / 曜数” (Yaojie / Yaoshu - 光芒、高维度、宇宙级)
  'yaojielabs.com',
  'yaojietech.com',
  'yaoshulabs.com',
  'yaoshutech.com',

  // 4. “墨界 / 墨矩” (Mojie / Moju - 数字水墨、软件工坊与游戏构筑)
  'mojielabs.com',
  'mojieworks.com',
  'mojuestudio.com',

  // 5. “灵矩 / 智矩” (Lingju / Zhiju - 灵动矩阵、智慧规矩)
  'lingjulabs.com',
  'lingjutech.com',
  'zhijulabs.com',
  'zhijutech.com',

  // 6. “幻域 / 幻维” (Huanyu / Huanwei - 沉浸虚拟、游戏与AI宇宙)
  'huanyulabs.com',
  'huanweilabs.com',
  'huanweitech.com',

  // 7. “数跃 / 创跃” (Shuyue / Chuangyue - 数字化跃迁)
  'shuyuelabs.com',
  'chuangyuelabs.com'
];

function checkDomain(domain) {
  return new Promise((resolve) => {
    const req = https.get('https://rdap.verisign.com/com/v1/domain/' + domain, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      resolve({ domain, isFree: res.statusCode === 404 });
    });
    req.on('error', () => resolve({ domain, isFree: false }));
    req.setTimeout(4000, () => { req.destroy(); resolve({ domain, isFree: false }); });
  });
}

async function main() {
  const freeList = [];
  for (const d of candidates) {
    const r = await checkDomain(d);
    if (r.isFree) {
      freeList.push(d);
    }
    await new Promise(res => setTimeout(res, 100));
  }
  console.log('FREE_CHINESE_DOMAINS:', JSON.stringify(freeList, null, 2));
}

main();

