/**
 * 웹 앱 접속 시 index.html 반환
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('SIS-A 척도 관리 시스템')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 1. 데이터 처리 및 저장 함수
 */
function processSIS(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    var timestamp = new Date();
    // 저장 시점의 타임존에 맞춰 문자열로 변환하여 저장
    var dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    var key = "SIS_" + timestamp.getTime().toString(36).toUpperCase();

    // 데이터 파싱 (숫자가 아닌 경우 0으로 처리하는 안전장치 추가)
    var raw = {
      p2A: parseInt(data.raw2A) || 0, p2B: parseInt(data.raw2B) || 0, p2C: parseInt(data.raw2C) || 0,
      p2D: parseInt(data.raw2D) || 0, p2E: parseInt(data.raw2E) || 0, p2F: parseInt(data.raw2F) || 0
    };

    // 표준점수 변환
    var std = {
      p2A: getStandardScore('2A', raw.p2A), p2B: getStandardScore('2B', raw.p2B), p2C: getStandardScore('2C', raw.p2C),
      p2D: getStandardScore('2D', raw.p2D), p2E: getStandardScore('2E', raw.p2E), p2F: getStandardScore('2F', raw.p2F)
    };

    // 합계 및 결과 산출
    var totalStdScore = std.p2A + std.p2B + std.p2C + std.p2D + std.p2E + std.p2F;
    var finalResult = getIndexAndPercentile(totalStdScore);

    // 시트에 저장 (배열 순서: Key, 날짜, 이름, 원점수6개, 표준점수6개, 합계, 지수, 백분위)
    sheet.appendRow([
      key, dateStr, data.name,
      raw.p2A, raw.p2B, raw.p2C, raw.p2D, raw.p2E, raw.p2F,
      std.p2A, std.p2B, std.p2C, std.p2D, std.p2E, std.p2F,
      totalStdScore, finalResult.indexScore, finalResult.percentile
    ]);

    return {
      success: true,
      data: {
        name: data.name, date: dateStr,
        raw: raw, std: std, total: totalStdScore,
        indexScore: finalResult.indexScore, percentile: finalResult.percentile
      }
    };
  } catch (e) {
    Logger.log("Error in processSIS: " + e.toString());
    return { success: false, message: e.toString() };
  }
}

/**
 * 2. 데이터 검색 및 전체 조회 함수 (수정됨: 빈 행 및 날짜 오류 해결)
 */
function searchSISData(query) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    var lastRow = sheet.getLastRow();
    
    // 데이터가 헤더(1행)밖에 없거나 아예 없으면 빈 배열 반환
    if (lastRow < 2) return []; 

    // 전체 데이터 가져오기 (A2부터 R열 마지막 행까지)
    var data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
    var result = [];
    
    // 검색어 정규화 (소문자 변환 및 공백 제거)
    var safeQuery = query ? query.toString().toLowerCase().trim() : "";

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      
      // [안전장치] Key(0번인덱스)나 이름(2번인덱스)이 없는 빈 행은 건너뜀
      if (!row[0] || !row[2]) continue;

      var nameVal = row[2].toString();
      
      // [안전장치] 날짜 객체 직렬화 처리
      var dateVal = row[1];
      if (dateVal instanceof Date) {
        dateVal = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
      } else {
        dateVal = dateVal.toString();
      }

      // 검색 조건: 검색어가 없거나, 이름에 검색어가 포함된 경우
      if (safeQuery === "" || nameVal.toLowerCase().indexOf(safeQuery) > -1) {
        result.push({
          key: row[0],
          date: dateVal,
          name: nameVal,
          raw: { p2A: row[3], p2B: row[4], p2C: row[5], p2D: row[6], p2E: row[7], p2F: row[8] },
          std: { p2A: row[9], p2B: row[10], p2C: row[11], p2D: row[12], p2E: row[13], p2F: row[14] },
          total: row[15],
          indexScore: row[16],
          percentile: row[17]
        });
      }
    }
    
    // 최신순 정렬 (역순)
    return result.reverse(); 
  } catch (e) {
    // 에러 로그 기록 후 빈 배열 반환 (앱이 멈추지 않도록 함)
    Logger.log("Error in searchSISData: " + e.toString()); 
    return [];
  }
}

// --- 3. 계산 로직 (기존 로직 유지) ---
function getStandardScore(type, score) {
  var ranges = [
    { s: 20, r: [[999,999], [999,999], [999,999], [999,999], [999,999], [999,999]] },
    { s: 19, r: [[89,999], [999,999], [999,999], [999,999], [999,999], [999,999]] },
    { s: 18, r: [[87,88], [999,999], [999,999], [999,999], [999,999], [999,999]] },
    { s: 17, r: [[85,86], [91,999], [999,999], [999,999], [999,999], [999,999]] },
    { s: 16, r: [[81,84], [88,90], [97,999], [999,999], [92,999], [999,999]] },
    { s: 15, r: [[77,80], [84,87], [92,96], [999,999], [86,91], [91,999]] },
    { s: 14, r: [[73,76], [79,83], [86,91], [85,999], [79,85], [84,90]] },
    { s: 13, r: [[68,72], [74,78], [79,85], [78,84], [72,78], [76,83]] },
    { s: 12, r: [[62,67], [69,73], [72,78], [70,77], [65,71], [68,75]] },
    { s: 11, r: [[55,61], [63,68], [64,71], [61,69], [57,64], [58,67]] },
    { s: 10, r: [[48,54], [56,62], [55,63], [52,60], [49,56], [48,57]] },
    { s: 9,  r: [[40,47], [49,55], [46,54], [42,51], [42,48], [38,47]] },
    { s: 8,  r: [[32,39], [41,48], [36,45], [32,41], [34,41], [28,37]] },
    { s: 7,  r: [[25,31], [33,40], [27,35], [23,31], [27,33], [19,27]] },
    { s: 6,  r: [[18,24], [25,32], [18,26], [15,22], [20,26], [10,18]] },
    { s: 5,  r: [[11,17], [16,24], [9,17],  [7,14],  [13,19], [3,9]] },
    { s: 4,  r: [[3,10],  [6,15],  [0,8],   [4,6],   [7,12],  [3,3]] },
    { s: 3,  r: [[0,2],   [0,5],   [-1,-1], [-1,-1], [1,6],   [1,1]] },
    { s: 2,  r: [[-1,-1], [-1,-1], [-1,-1], [-1,-1], [0,0],   [2,999]] },
    { s: 1,  r: [[-1,-1], [-1,-1], [-1,-1], [-1,-1], [-1,-1], [-1,-1]] }
  ];

  var idxMap = { '2A':0, '2B':1, '2C':2, '2D':3, '2E':4, '2F':5 };
  var idx = idxMap[type];

  for (var i = 0; i < ranges.length; i++) {
    var min = ranges[i].r[idx][0];
    var max = ranges[i].r[idx][1];
    if (min === -1) continue;
    if (score >= min && score <= max) return ranges[i].s;
  }
  if(score > 60) return 19;
  if(score < 3) return 3; 
  return 1; 
}

function getIndexAndPercentile(total) {
  if (total >= 91) return { indexScore: "136-143", percentile: ">99" };
  if (total >= 88) return { indexScore: "132-135", percentile: "99" };
  if (total >= 86) return { indexScore: "130-131", percentile: "98" };
  if (total >= 84) return { indexScore: "128-129", percentile: "97" };
  if (total === 83) return { indexScore: "126", percentile: "96" };
  if (total >= 81) return { indexScore: "124-125", percentile: "95" };
  if (total === 80) return { indexScore: "123", percentile: "94" };
  if (total === 79) return { indexScore: "122", percentile: "93" };
  if (total === 78) return { indexScore: "121", percentile: "92" };
  if (total === 77) return { indexScore: "120", percentile: "91" };
  if (total === 76) return { indexScore: "118", percentile: "89" };
  if (total === 75) return { indexScore: "117", percentile: "87" };
  if (total === 74) return { indexScore: "116", percentile: "86" };
  if (total === 73) return { indexScore: "115", percentile: "84" };
  if (total === 72) return { indexScore: "114", percentile: "82" };
  if (total === 71) return { indexScore: "113", percentile: "81" };
  if (total === 70) return { indexScore: "111", percentile: "77" };
  if (total === 69) return { indexScore: "110", percentile: "75" };
  if (total === 68) return { indexScore: "109", percentile: "73" };
  if (total === 67) return { indexScore: "108", percentile: "70" };
  if (total === 66) return { indexScore: "107", percentile: "68" };
  if (total === 65) return { indexScore: "106", percentile: "65" };
  if (total === 64) return { indexScore: "105", percentile: "63" };
  if (total === 63) return { indexScore: "103", percentile: "58" };
  if (total === 62) return { indexScore: "102", percentile: "55" };
  if (total === 61) return { indexScore: "101", percentile: "53" };
  if (total === 60) return { indexScore: "100", percentile: "50" };
  if (total === 59) return { indexScore: "99", percentile: "47" };
  if (total === 58) return { indexScore: "98", percentile: "45" };
  if (total === 57) return { indexScore: "96", percentile: "39" };
  if (total === 56) return { indexScore: "95", percentile: "37" };
  if (total === 55) return { indexScore: "94", percentile: "35" };
  if (total === 54) return { indexScore: "93", percentile: "32" };
  if (total === 53) return { indexScore: "92", percentile: "30" };
  if (total === 52) return { indexScore: "91", percentile: "27" };
  if (total === 51) return { indexScore: "90", percentile: "25" };
  if (total === 50) return { indexScore: "89", percentile: "23" };
  if (total === 49) return { indexScore: "87", percentile: "19" };
  if (total === 48) return { indexScore: "86", percentile: "18" };
  if (total === 47) return { indexScore: "85", percentile: "16" };
  if (total === 46) return { indexScore: "84", percentile: "14" };
  if (total >= 44) return { indexScore: "82-83", percentile: "13" };
  if (total === 43) return { indexScore: "80", percentile: "9" };
  if (total === 42) return { indexScore: "79", percentile: "8" };
  if (total === 41) return { indexScore: "78", percentile: "7" };
  if (total === 40) return { indexScore: "77", percentile: "6" };
  if (total >= 38) return { indexScore: "75-76", percentile: "5" };
  if (total === 37) return { indexScore: "74", percentile: "4" };
  if (total >= 35) return { indexScore: "71-72", percentile: "3" };
  if (total >= 33) return { indexScore: "69-70", percentile: "2" };
  if (total >= 30) return { indexScore: "65-68", percentile: "1" };
  return { indexScore: "38-64", percentile: "<1" };
}