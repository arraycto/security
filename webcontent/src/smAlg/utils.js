/* eslint-disable no-bitwise, no-mixed-operators, no-use-before-define, max-len */
const {BigInteger, SecureRandom} = require('jsbn')
const {ECCurveFp} = require('./ec')

const rng = new SecureRandom()
const {curve, G, n} = generateEcparam()

/**
 * 获取公共椭圆曲线
 */
function getGlobalCurve() {
  return curve
}

/**
 * 生成ecparam
 */
function generateEcparam() {
  // 椭圆曲线
  const p = new BigInteger('FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF', 16)
  const a = new BigInteger('FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC', 16)
  const b = new BigInteger('28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93', 16)
  const curve = new ECCurveFp(p, a, b)

  // 基点
  const gxHex = '32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7'
  const gyHex = 'BC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0'
  const G = curve.decodePointHex('04' + gxHex + gyHex)

  const n = new BigInteger('FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123', 16)

  return {curve, G, n}
}

/**
 * 生成密钥对
 */
function generateKeyPairHex() {
  const d = new BigInteger(n.bitLength(), rng).mod(n.subtract(BigInteger.ONE)).add(BigInteger.ONE) // 随机数
  const privateKey = leftPad(d.toString(16), 64)

  const P = G.multiply(d) // P = dG，p 为公钥，d 为私钥
  const Px = leftPad(P.getX().toBigInteger().toString(16), 64)
  const Py = leftPad(P.getY().toBigInteger().toString(16), 64)
  const publicKey = '04' + Px + Py

  return {privateKey, publicKey}
}

/**
 * 解析utf8字符串到16进制
 */
function parseUtf8StringToHex(input) {
  input = unescape(encodeURIComponent(input))

  const length = input.length

  // 转换到字数组
  const words = []
  for (let i = 0; i < length; i++) {
    words[i >>> 2] |= (input.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
  }

  // 转换到16进制
  const hexChars = []
  for (let i = 0; i < length; i++) {
    const bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    hexChars.push((bite >>> 4).toString(16))
    hexChars.push((bite & 0x0f).toString(16))
  }

  return hexChars.join('')
}

/**
 * 解析arrayBuffer到16进制字符串
 */
function parseArrayBufferToHex(input) {
  return Array.prototype.map.call(new Uint8Array(input), x => ('00' + x.toString(16)).slice(-2)).join('')
}

/**
 * 补全16进制字符串
 */
function leftPad(input, num) {
  if (input.length >= num) return input

  return (new Array(num - input.length + 1)).join('0') + input
}

/**
 * 转成16进制串
 */
function arrayToHex(arr) {
  const words = []
  let j = 0
  for (let i = 0; i < arr.length * 2; i += 2) {
    const v = arr[j] < 0 ? 256 + arr[j] : arr[j]
    words[i >>> 3] |= parseInt(v, 10) << (24 - (i % 8) * 4)
    j++
  }

  // 转换到16进制
  const hexChars = []
  for (let i = 0; i < arr.length; i++) {
    const bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    hexChars.push((bite >>> 4).toString(16))
    hexChars.push((bite & 0x0f).toString(16))
  }

  return hexChars.join('')
}

/**
 * 转成utf8串
 */
function arrayToString(arr) {
  const words = []
  let j = 0
  for (let i = 0; i < arr.length * 2; i += 2) {
    const v = arr[j] < 0 ? 256 + arr[j] : arr[j]
    words[i >>> 3] |= parseInt(v, 10) << (24 - (i % 8) * 4)
    j++
  }

  try {
    const latin1Chars = []

    for (let i = 0; i < arr.length; i++) {
      const bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
      latin1Chars.push(String.fromCharCode(bite))
    }

    return decodeURIComponent(escape(latin1Chars.join('')))
  } catch (e) {
    throw new Error('Malformed UTF-8 data')
  }
}

/**
 * 转成ascii码数组
 */
function hexToArray(hexStr) {
  const words = []
  let hexStrLength = hexStr.length

  if (hexStrLength % 2 !== 0) {
    hexStr = leftPad(hexStr, hexStrLength + 1)
  }

  hexStrLength = hexStr.length

  for (let i = 0; i < hexStrLength; i += 2) {
    const v = parseInt(hexStr.substr(i, 2), 16)
    words.push(v > 127 ? v - 256 : v)
  }
  return words
}


function stringToArr(str) {
  const bytes = []
  const len = str.length
  let c
  for (let i = 0; i < len; i++) {
    c = str.charCodeAt(i)
    if (c >= 0x010000 && c <= 0x10FFFF) {
      bytes.push(((c >> 18) & 0x07) | 0xF0 - 256)
      bytes.push(((c >> 12) & 0x3F) | 0x80 - 256)
      bytes.push(((c >> 6) & 0x3F) | 0x80 - 256)
      bytes.push((c & 0x3F) | 0x80)
    } else if (c >= 0x000800 && c <= 0x00FFFF - 256) {
      bytes.push(((c >> 12) & 0x0F) | 0xE0 - 256)
      bytes.push(((c >> 6) & 0x3F) | 0x80 - 256)
      bytes.push((c & 0x3F) | 0x80 - 256)
    } else if (c >= 0x000080 && c <= 0x0007FF - 256) {
      bytes.push(((c >> 6) & 0x1F) | 0xC0 - 256)
      bytes.push((c & 0x3F) | 0x80 - 256)
    } else {
      bytes.push(c & 0xFF - 256)
    }
  }
  return bytes
}

function fillSm4Data(str) {
  const fsda = stringToArr(str)
  let fsdh = arrayToHex(fsda)
  const len = fsdh.length % 32
  let fd = '80000000000000000000000000000000'
  if (len !== 0) {
    fd = fd.substr(0, 32 - len)
    fsdh += fd
  } else {
    fsdh += fd
  }
  return fsdh.toUpperCase()
}

function analysisSm4Data(fsdh) {
  const index = fsdh.lastIndexOf('80')
  const end = fsdh.substr(index + 2)
  for (let i = 0; i < end.length; i++) {
    if (i !== end.length - 1 && end.substr(i, 2) !== '00') {
      return 'not fill data!'
    }
  }
  return arrayToString(hexToArray(fsdh.substr(0, index)))
}
module.exports = {
  getGlobalCurve,
  generateEcparam,
  generateKeyPairHex,
  parseUtf8StringToHex,
  parseArrayBufferToHex,
  leftPad,
  fillSm4Data,
  analysisSm4Data,
  arrayToHex,
  arrayToString,
  hexToArray,
  stringToArr,
}
