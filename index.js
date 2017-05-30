'use strict';
const jsdom = require('jsdom');
let http = require('http');
const REV = "http://www.capcom.co.jp/arcade/rev/PC/";
const REV_HIGHSCORE = `${REV}ranking_highscore.html`;

const POINT_FOR_DIFFICULTY = {
  "EASY": 1,
  "STANDARD": 2,
  "HARD": 3,
  "MASTER": 5,
  "UNLIMITED": 10,
};

const PREFECTURES = `北海道 青森県 岩手県 宮城県 秋田県
山形県 福島県 茨城県 栃木県 群馬県 埼玉県
千葉県 東京都 神奈川県 新潟県 富山県 石川県
福井県 山梨県 長野県 岐阜県 静岡県 愛知県
三重県 滋賀県 京都府 大阪府 兵庫県 奈良県
和歌山県 鳥取県 島根県 岡山県 広島県 山口県
徳島県 香川県 愛媛県 高知県 福岡県 佐賀県
長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県
海外`.split(/\s/);

let prefecturePoint = {};

PREFECTURES.forEach(prefecture => {
  prefecturePoint[prefecture] = 0;
});

const PAGE_LIMIT = 10;

/* この方法は同時アクセス数が多すぎて怒られるっぽい
let pageList = [];
for (let i = 1; i <= PAGE_LIMIT; i++) {
  pageList.push(accessHighscoreRanking(i));
}

Promise.all(pageList).then(function () {
  console.log(prefecturePoint);
}).catch(function (e) {
  console.log(e);
});
*/

let promise = Promise.resolve();
for (let i = 1; i <= PAGE_LIMIT; i++) {
  promise = promise.then(createHighscoreRankingPromise(i));
}
promise.then(function() {
  console.log(prefecturePoint);
}).catch(function(e){
  console.log(e);
});

function createHighscoreRankingPromise(page) {
  return () => accessHighscoreRanking(page);
}

function accessHighscoreRanking(page) {
  return new Promise(function (resolve, reject) {
    //console.log(`start on page:${page}`);
    http.get(`${REV_HIGHSCORE}?page=${page}`, res => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', chunk => body += chunk);
      res.on('end', res => {
        let doc = jsdom.jsdom(body.toString());
        let $ = require('jquery')(doc.defaultView);
        let musics = $(doc).find("div.rkHiscoreCv");
        let musicDatas = [];
        musics.each((i, musicData) => musicDatas.push(musicData));
        Promise.all(musicDatas.map(musicData => parseMusicRanking($, musicData)))
          .then(function() {
            //console.log(`end on page:${page}`);
            resolve();
            //accessHighscoreRanking(page + 1);
          });
      });
    }).on('error', e => {
      reject(e.message);
    });
  });
}

function parseMusicRanking($, musicData) {
  return new Promise(function (resolve, reject) {
    let linkList = [];
    $(musicData).find("ul.rkLinkList > li > a").each((i, rankLink) => {
      linkList.push(rankLink)
    });
    //console.log(linkList.length);

    Promise.all(linkList.map(rankLink => calcPoint($, rankLink)))
      .then(function () {
        //console.log("calcPoint all resolve");
        resolve();
      });
  });
}

function calcPoint($, rankLink) {
  return new Promise(function (resolve, reject) {
    const href = $(rankLink).attr("href");
    const difficulty = $(rankLink).text();

    http.get(REV + href, res => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', chunk => body += chunk);
      res.on('end', res => {
        let doc = jsdom.jsdom(body.toString());
        let $ = require('jquery')(doc.defaultView);
        const topPlayerHtml = $(doc).find("li.rankTop").first();
        const prefecture = $(topPlayerHtml).find("p.rkLocationHead").first().text().replace("登録地域：", "").replace(/\s/, "");
        prefecturePoint[prefecture] += POINT_FOR_DIFFICULTY[difficulty];
        //console.log(`${prefecture}: ${POINT_FOR_DIFFICULTY[difficulty]}`);
        resolve();
      });
    });
  });
}

