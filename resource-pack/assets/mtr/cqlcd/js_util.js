/*
 * 几个跨文件共用的小工具。
 *
 * MTR 的名字字段用「中文|English||编号」的形式拼在一起，
 * getMatching() 负责按需要取出其中一部分。
 */

/**
 * 从 MTR 的名字字段里取出中文部分或英文部分。
 * @param {*} src 原始名字，例如「重庆轨道交通5号线|CHONGQING Metro line 5」。
 * @param {Boolean} isCjk 取中文部分传 true，取英文部分传 false。
 * @return {String} 取出的部分，没有对应部分时原样返回。
 */
function getMatching(src, isCjk) {
    src = String(src);
    if (!src.includes("|")) {
        return src.includes("||") ? String(TextUtil.getNonExtraParts(src)) : src;
    }
    return isCjk ? String(TextUtil.getCjkParts(src)) : String(TextUtil.getNonCjkParts(src));
}

/**
 * 检查对象上某个属性是否存在且等于给定值，用于判断状态有没有变化。
 * @param {*} obj 要检查的对象。
 * @param {String} propName 属性名。
 * @param {*} propValue 期望的属性值。
 * @return {Boolean} 属性存在且相等时返回 true。
 */
function checkProperty(obj, propName, propValue) {
    return (obj != null && propName in obj) ? obj[propName] == propValue : false;
}
