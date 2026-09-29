// var AesUtil = function(keySize, iterationCount) {
//   this.keySize = keySize / 32;
//   this.iterationCount = iterationCount;
// };

// AesUtil.prototype.generateKey = function(salt, passPhrase) {
//   var key = CryptoJS.PBKDF2(
//       passPhrase,
//       CryptoJS.enc.Hex.parse(salt),
//       { keySize: this.keySize, iterations: this.iterationCount });
//   return key;
// }

// AesUtil.prototype.encrypt = function(salt, iv, passPhrase, plainText) {
//   var key = this.generateKey(salt, passPhrase);
//   var encrypted = CryptoJS.AES.encrypt(
//       plainText,
//       key,
//       { iv: CryptoJS.enc.Hex.parse(iv) });
//   return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
// }

// AesUtil.prototype.decrypt = function(salt, iv, passPhrase, cipherText) {
//   var key = this.generateKey(salt, passPhrase);
//   var cipherParams = CryptoJS.lib.CipherParams.create({
//     ciphertext: CryptoJS.enc.Base64.parse(cipherText)
//   });
//   var decrypted = CryptoJS.AES.decrypt(
//       cipherParams,
//       key,
//       { iv: CryptoJS.enc.Hex.parse(iv) });
//   return decrypted.toString(CryptoJS.enc.Utf8);
// }

// AesUtil.prototype.ltyEncrypt = function(plaintext) {
//     if(!plaintext) return;
//     var four = CryptoJS.lib.WordArray.random(128/8).toString(CryptoJS.enc.Hex);
//     var salt = CryptoJS.lib.WordArray.random(128/8).toString(CryptoJS.enc.Hex);
//     var ciphertext = this.encrypt(salt, four, "asianpaints", plaintext);
//     return (salt + four + ciphertext);
// }

// eslint-disable-next-line no-underscore-dangle
const _0x54c3 = ['Utf8', 'toString', 'parse', 'Hex', 'AES', 'ciphertext', 'Base64', 'decrypt', 'random', 'generateKey', 'keySize', 'iterationCount', 'prototype', 'lib', 'encrypt', 'asianpaints', 'WordArray', 'CipherParams', 'enc'];(function(_0x5bdeb8, _0x22bd12){var _0x54c358=function(_0x345cee){while(--_0x345cee){_0x5bdeb8['push'](_0x5bdeb8['shift']());}};_0x54c358(++_0x22bd12);}(_0x54c3,0x17b));var _0x345c=function(_0x5bdeb8, _0x22bd12){_0x5bdeb8=_0x5bdeb8-0x1d4;var _0x54c358=_0x54c3[_0x5bdeb8];return _0x54c358;};var _0x4af663=_0x345c,AesUtil=function(_0x5c1d70, _0xb369fa){var _0x290d54=_0x345c;this[_0x290d54(0x1df)]=_0x5c1d70/0x20,this['iterationCount']=_0xb369fa;};AesUtil[_0x4af663(0x1e1)][_0x4af663(0x1de)]=function(_0x3c3bd2, _0x5f5546){var _0x15bb19=_0x4af663,_0x2dbb05=CryptoJS['PBKDF2'](_0x5f5546,CryptoJS['enc']['Hex'][_0x15bb19(0x1d7)](_0x3c3bd2),{'keySize':this[_0x15bb19(0x1df)],'iterations':this[_0x15bb19(0x1e0)]});return _0x2dbb05;},AesUtil[_0x4af663(0x1e1)]['encrypt']=function(_0x1be5f4, _0x4cedff, _0x393955, _0xdcf4ce){var _0x382b38=_0x4af663,_0x125c07=this[_0x382b38(0x1de)](_0x1be5f4,_0x393955),_0x4009b0=CryptoJS[_0x382b38(0x1d9)]['encrypt'](_0xdcf4ce,_0x125c07,{'iv':CryptoJS[_0x382b38(0x1d4)][_0x382b38(0x1d8)][_0x382b38(0x1d7)](_0x4cedff)});return _0x4009b0[_0x382b38(0x1da)][_0x382b38(0x1d6)](CryptoJS[_0x382b38(0x1d4)][_0x382b38(0x1db)]);},AesUtil['prototype'][_0x4af663(0x1dc)]=function(_0x267267, _0x45a107, _0x37e030, _0x245ae5){var _0x2ce7b3=_0x4af663,_0x4fcd67=this['generateKey'](_0x267267,_0x37e030),_0x138278=CryptoJS[_0x2ce7b3(0x1e2)][_0x2ce7b3(0x1e6)]['create']({'ciphertext':CryptoJS[_0x2ce7b3(0x1d4)][_0x2ce7b3(0x1db)][_0x2ce7b3(0x1d7)](_0x245ae5)}),_0x24f236=CryptoJS[_0x2ce7b3(0x1d9)][_0x2ce7b3(0x1dc)](_0x138278,_0x4fcd67,{'iv':CryptoJS[_0x2ce7b3(0x1d4)][_0x2ce7b3(0x1d8)][_0x2ce7b3(0x1d7)](_0x45a107)});return _0x24f236[_0x2ce7b3(0x1d6)](CryptoJS['enc'][_0x2ce7b3(0x1d5)]);},AesUtil[_0x4af663(0x1e1)]['ltyEncrypt']=function(_0x3e5648){var _0x10f740=_0x4af663;if(!_0x3e5648)return;var _0x16f3d4=CryptoJS[_0x10f740(0x1e2)][_0x10f740(0x1e5)][_0x10f740(0x1dd)](0x80/0x8)[_0x10f740(0x1d6)](CryptoJS[_0x10f740(0x1d4)]['Hex']),_0x3612a5=CryptoJS['lib'][_0x10f740(0x1e5)][_0x10f740(0x1dd)](0x80/0x8)['toString'](CryptoJS[_0x10f740(0x1d4)][_0x10f740(0x1d8)]),_0x3df0e1=this[_0x10f740(0x1e3)](_0x3612a5,_0x16f3d4,_0x10f740(0x1e4),_0x3e5648);return _0x3612a5+_0x16f3d4+_0x3df0e1;};

export { AesUtil };
export default AesUtil;
