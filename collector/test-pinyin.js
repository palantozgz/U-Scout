const { pinyin } = require('./node_modules/pinyin-pro');

const tests = [
  { zh: '张明珠', en: 'ZhangMingzhu' },
  { zh: '杜思宇', en: 'dusiyu' },
  { zh: '张含', en: 'zhanghan' },
  { zh: '霍俊彤', en: 'Huojuntong' },
  { zh: '李海娜', en: 'lihaina' },
  { zh: '宋珂昕', en: 'Kexin Song' },
  { zh: '*夏奇拉-奥斯汀', en: 'Shakira Austin' },
  { zh: '玛琳娜-惠特尔', en: 'MARENA JOSEPHINE WHITTLE' },
  { zh: '史蒂芬妮-里德', en: 'Stephanie Reid' },
  { zh: '王思雨', en: 'wangsiyu' },
];

function titleCase(str) {
  return str.split(/\s+/).map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function isForiegn(nameZh) {
  // Extranjera: empieza con * O contiene guión - (nombre transliterado)
  return nameZh.startsWith('*') || nameZh.includes('-');
}

function toEnglishName(nameZh, nameEn) {
  if (!nameZh) return nameEn ? titleCase(nameEn) : null;
  if (isForiegn(nameZh)) {
    return nameEn ? titleCase(nameEn) : null;
  }
  var chineseChars = Array.from(nameZh).filter(function(c) { return /[\u4e00-\u9fff]/.test(c); });
  if (chineseChars.length < 2) return nameEn ? titleCase(nameEn) : null;
  // Carácter por carácter → sílabas en minúscula
  var syllables = chineseChars.map(function(c) {
    var p = pinyin(c, { toneType: 'none', type: 'array' });
    return (p[0] || c).toLowerCase();
  });
  // Apellido capitalizado + espacio + nombre (sílabas unidas, primera mayúscula)
  var surname = syllables[0].charAt(0).toUpperCase() + syllables[0].slice(1);
  var givenRaw = syllables.slice(1).join('');
  var given = givenRaw.charAt(0).toUpperCase() + givenRaw.slice(1);
  return surname + ' ' + given;
}

tests.forEach(function(t) {
  console.log(t.zh + ' -> ' + toEnglishName(t.zh, t.en));
});
