const puppeteer = require("puppeteer");
const dateFinder = require("datefinder");
const fs = require("fs");
require("dotenv").config();
// Đọc dữ liệu test từ file input
// const conferences = require('./test-data/conferences.json');
// Tiền xử lý trước khi trích xuất ngày tháng
const formatString = (str) => {
    return str
        .replace(/(\s0)([1-9])\b/g, "$2")
        .replace(/(\d+)(st|nd|rd|th),/g, "$1,");
};
// Xử lý khi datefinder tìm được nhiều ngày
const findClosestDate = (dateResults, keywordIndex, keywordLength) => {
    if (dateResults.length === 1) {
        return dateResults[0].date;
    }
    let closestDate = dateResults.reduce((closest, result) => {
        let diff = 0;
        if (result.startIndex < keywordIndex) {
            let dateIndex = result.endIndex;
            diff = Math.abs(keywordIndex - dateIndex);
        } else {
            let dateIndex = result.startIndex;
            diff = Math.abs(dateIndex - keywordIndex - keywordLength);
        }

        if (closest === null || diff < closest.diff) {
            return { date: result.date, diff: diff };
        }

        return closest;
    }, null);

    return closestDate.date;

};
const isFakeNews = (array, keywordToCheck) => {
    if (
        array.some((item) =>
            item.keyword.toLowerCase().includes(keywordToCheck.toLowerCase())
        )
    ) {
        return true;
    }
    return false;
};
// Hàm lấy danh sách hội nghị từ ICORE Conference Portal
const getConferenceList = (browser) =>
    new Promise(async (resolve, reject) => {
        try {
            let currentLink =`
                ${process.env.PORTAL}?search=&by=${ process.env.BY }&source=${ process.env.CORE2023}&sort=${ process.env.SORT }&page=${ process.env.PAGE }`;
            console.log(currentLink);
            // Lấy tổng số trang
            const totalPages = await getTotalPages(browser, currentLink);

            // Mảng chứa danh sách tất cả hội nghị
            let allConferences = [];

            // Lặp qua từng trang và trích xuất dữ liệu hội nghị
            for (let i = 1; i <= totalPages; i++) {
                let conferencesOnPage = await getConferencesOnPage(
                    browser,
                    currentLink.slice(0, -1) + i
                );
                allConferences = allConferences.concat(conferencesOnPage);
            }

            resolve(allConferences);
        } catch (error) {
            console.log("Error in getConferenceList:", error);
            reject(error);
        }
    });

// Hàm tìm kiếm các liên kết trang web của hội nghị trên Google
const searchConferenceLinks = async (browser, conference) => {
    try {
        // Số lượng liên kết tối đa cần thu thập
        const maxLinks = 4;
        // Mảng chứa các liên kết
        let links = [];

        // Mở tab mới
        let page = await browser.newPage();

        // Tìm kiếm trên Google với từ khóa là Acronym + 2023
        await page.goto("https://www.google.com/");
        await page.waitForSelector("#APjFqb");
        await page.keyboard.sendCharacter(conference.Acronym + " 2023");
        await page.keyboard.press("Enter");
        await page.waitForNavigation();
        await page.waitForSelector("#search");

        while (links.length < maxLinks) {
            const linkList = await page.$$eval("#search a", (els) => {
                const result = [];
                const unwantedDomains = [
                    "scholar.google",
                    "translate.google",
                    "google.com",
                    "wikicfp.com",
                    "dblp.org",
                    "medium.com",
                    "dl.acm.org",
                    "easychair.org",
                    "youtube.com"
                ];
                for (const el of els) {
                    const href = el.href;
                    // Kiểm tra xem liên kết có chứa tên miền không mong muốn
                    if (
                        !unwantedDomains.some((domain) => href.includes(domain))
                    ) {
                        result.push({
                            link: href,
                        });
                    }
                }
                return result;
            });

            links = links.concat(linkList.map((item) => item.link));

            // Nếu links có nhiều hơn maxLinks, cắt bớt
            if (links.length > maxLinks) {
                links = links.slice(0, maxLinks);
            }

            if (links.length < maxLinks) {
                // Chưa đủ liên kết, tiếp tục tìm kiếm bằng cách cuộn xuống
                await page.keyboard.press("PageDown");
                await page.waitForTimeout(2000);
            }
        }

        await page.close();

        return links.slice(0, maxLinks);
    } catch (error) {
        console.log("Error in searchConferenceLinks:", error);
        // Xử lý lỗi
    }

};
// Get conference date, submisstion date, notification date, ...
const getConferenceDetails = async (browser, conference) => {
    try {
        // Getting keywords from dict
        const submissionDate_keywords = fs
            .readFileSync(__dirname + "/dict/submission_date_dict.txt", "utf-8")
            .split("\n")
            .map((keyword) => keyword.trim());
        const conferenceDate_keywords = fs
            .readFileSync(__dirname + "/dict/conference_date_dict.txt", "utf-8")
            .split("\n")
            .map((keyword) => keyword.trim());
        const notificationDate_keywords = fs
            .readFileSync(
                __dirname + "/dict/notification_date_dict.txt",
                "utf-8"
            )
            .split("\n")
            .map((keyword) => keyword.trim());
        // For each conference link
        for (let k = 0; k < conference.Links.length; k++) {
            const submissionDate = [];
            const conferenceDate = [];
            const notificationDate = [];

            setTimeout(function () { }, Math.floor(Math.random() * 2000) + 1000);

            const page = await browser.newPage();
            await page.goto(`${conference.Links[k]}`, {
                waitUntil: "domcontentloaded",
            });

            const bodyContent = await page.content();

            // Getting submisstion date
            for (const keyword of submissionDate_keywords) {
                let index = bodyContent.indexOf(keyword);
                while (index !== -1 && index < bodyContent.length) {
                    const snapshot = bodyContent.substring(
                        Math.max(0, index - 50),
                        index + keyword.length + 100
                    );
                    const submissionDateFinder = dateFinder(
                        formatString(snapshot)
                    );
                    if (submissionDateFinder.length > 0) {
                        if (!isFakeNews(submissionDate, keyword)) {
                            submissionDate.push({
                                date: findClosestDate(
                                    submissionDateFinder,
                                    snapshot.indexOf(keyword),
                                    keyword.length
                                ),
                                keyword: keyword,
                                update_time: new Date(),
                            });
                        }
                        break;
                    }
                    index = bodyContent.indexOf(keyword, index + 1);
                }
            }

            // Getting conference date
            for (const keyword of conferenceDate_keywords) {
                if (conferenceDate.length > 0) break;

                let index = bodyContent.indexOf(keyword);
                while (index !== -1 && index < bodyContent.length) {
                    const snapshot = bodyContent.substring(
                        Math.max(0, index - 50),
                        index + keyword.length + 100
                    );
                    const conferenceDateFinder = dateFinder(
                        formatString(snapshot)
                    );
                    if (conferenceDateFinder.length > 0) {
                        if (!isFakeNews(conferenceDate, keyword)) {
                            conferenceDate.push({
                                date: findClosestDate(
                                    conferenceDateFinder,
                                    snapshot.indexOf(keyword),
                                    keyword.length
                                ),
                                keyword: keyword,
                                update_time: new Date(),
                            });
                        }
                        break;
                    }
                    index = bodyContent.indexOf(keyword, index + 1);
                }
            }

            // Getting notification date
            for (const keyword of notificationDate_keywords) {
                let index = bodyContent.indexOf(keyword);
                while (index !== -1 && index < bodyContent.length) {
                    const snapshot = bodyContent.substring(
                        Math.max(0, index - 50),
                        index + keyword.length + 100
                    );
                    const notificationDateFinder = dateFinder(
                        formatString(snapshot)
                    );
                    if (notificationDateFinder.length > 0) {
                        if (!isFakeNews(notificationDate, keyword)) {
                            notificationDate.push({
                                date: findClosestDate(
                                    notificationDateFinder,
                                    snapshot.indexOf(keyword),
                                    keyword.length
                                ),
                                keyword: keyword,
                                update_time: new Date(),
                            });
                        }
                        break;
                    }
                    index = bodyContent.indexOf(keyword, index + 1);
                }
            }

            // Cập nhật dữ liệu vào object conference
            conference.ConferenceDate = conferenceDate;
            conference.SubmissonDate = submissionDate;
            conference.NotificationDate = notificationDate;
            conference.CallForPaper = "Not found";
            conference.Location = "Not found";
            conference.Type = "Not found";

            await page.close();
            break; // Thoát vòng lặp sau khi crawl thành công từ một link
        }
    } catch (error) {
        console.log(
            "Error in web-scraper-service/getConferenceDetails" + error
        );
    }

};
// Hàm lấy tổng số trang từ ICORE Conference Portal
async function getTotalPages(browser, url) {
    let page = await browser.newPage();
    await page.goto(url);

    const totalPages = await page.evaluate(() => {
        const pageElements = document.querySelectorAll("#search > a");
        let maxPage = 1;
        pageElements.forEach((element) => {
            const pageValue =
                element.textContent.length < 5
                    ? parseInt(element.textContent)
                    : null;
            if (!isNaN(pageValue) && pageValue > maxPage) {
                maxPage = pageValue;
            }
        });
        return maxPage;
    });

    return totalPages;

}
// Hàm lấy dữ liệu hội nghị từ một trang của ICORE Conference Portal
const getConferencesOnPage = (browser, currentLink) =>
    new Promise(async (resolve, reject) => {
        try {
            let page = await browser.newPage();
            await page.goto(currentLink);
            await page.waitForSelector("#container");

            const scrapeData = [];
            const data = await page.$$eval("#search > table tr td", (tds) =>
                tds.map((td) => td.innerText)
            );

            let currentIndex = 0;
            while (currentIndex < data.length) {
                const obj = {
                    Title: data[currentIndex],
                    Acronym: data[currentIndex + 1],
                    Source: data[currentIndex + 2],
                    Rank: data[currentIndex + 3],
                    Note: data[currentIndex + 4],
                    DBLP: data[currentIndex + 5],
                    PrimaryFoR: data[currentIndex + 6],
                    Comments: data[currentIndex + 7],
                    AverageRating: data[currentIndex + 8],
                };
                scrapeData.push(obj);
                currentIndex += 9;
            }

            await page.close();

            resolve(scrapeData);
        } catch (error) {
            reject(error);
        }
    });

async function testCrawler() {
    const browser = await puppeteer.launch();

    try {
        console.log("Crawling data from CORE2023...");
        const allConferences = await getConferenceList(browser); 

        for (const conference of allConferences) { 
            
   
            console.log(`Crawling data for conference: ${conference.Acronym}`);

            const links = await searchConferenceLinks(browser, conference);
            conference.Links = links;
            await getConferenceDetails(browser, conference);

            console.log('Conference details:', conference);

            const jsonData = JSON.stringify(conference, null, 2);
            fs.writeFileSync(`./test-data/${conference.Acronym}_data.json`, jsonData);

        } 
    } catch (error) {
        console.error(`Error crawling data for ${conference.Acronym}:`, error);
    }
    await browser.close();

}
testCrawler();

module.exports = {
    getConferenceList,
    searchConferenceLinks,
    getConferenceDetails,
};