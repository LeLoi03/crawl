const fs = require("fs");
const readline = require("readline");
/*
Text lấy được từ banner 

Lấy title input --> slice ra từ chữ conference on/of/... về sau

Sau đó cắt bỏ ngày tháng

*/
const readLocations = async (filePath) => {
  const locations = new Set();
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    locations.add(line.trim());
  }

  return locations;
};

const isInDict = async (link) => {
  let page = await browser.newPage();
  await page.goto(link, { waitUntil: "domcontentloaded" });
  try {
  } catch (error) {
  } finally {
    const bodyContent = await page.content();

    await page.close();

    const locations = await readLocations("./dict/locations.txt");
    console.log(locations);

    // for (const location of locations) {
    //   if (bodyContent.includes(location)) {
    //     return true;
    //   }
    // }
    return false;
  }
};

const getLocation = async (browser, title, link, isSigplan) => {
  try {
    console.log(">> Getting location from: " + link);

    let page = await browser.newPage();
    await page.goto(link, { waitUntil: "domcontentloaded" });
    try {
    } catch (error) {
    } finally {
      console.log("finally");

      let bodyContent = "";
      if (isSigplan) {
        bodyContent = await page.content();
      } else {
        bodyContent = await page.evaluate(() => {
          return document.body.innerText;
        });
      }

      await page.close();

      return extractLocation(bodyContent);
    }
  } catch (error) {
    console.log("Error in get Location: " + error);
    return "null";
  }
};

function removeDateAndFrom(text) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthRegex = new RegExp(`\\b(?:${months.join("|")})\\b.*$`, "i");

  const regexes = [
    /,\s*from\s+.*$/i, // Matches ", from" and everything after it
    /\bfrom\s+.*$/i, // Matches "from" and everything after it
    /,\s*on\s+.*?\s+(in|at)\s+/i, // Matches ", on" and everything until "in" or "at"
    /\bon\s+.*?\s+(in|at)\s+/i, // Matches "on" and everything until "in" or "at"
    /\bduring\s+.*$/i, // Matches "during" and everything after it
    /^.*?\bat\s+/i, // Matches everything until "at" and includes "at"
    monthRegex,
    /,\s+\d{1,2}(?:-\d{1,2})?,?\s*\d{4}/,
    /,\s*and\s+.*$/i, // Matches ", and" and everything after it
    /\band\s+.*$/i, // Matches "and" and everything after it
  ];

  let result = text;
  result = result.replace("in-person", "").trim();
  result = result.replace("in person", "").trim();
  console.log(result);
  for (const regex of regexes) {
    result = result.replace(regex, "").trim();
  }

  result = result.replace(/,\s*$/, "").trim();

  const removeKeyword = ["person", "on", "hybrid"];
  for (const key of removeKeyword) {
    const regex = new RegExp(`\\b${key}\\b`, "gi");
    result = result.replace(regex, "");
  }

  result = result.replace(/,\s*$/, "").trim();
  return result;
}

const extractLocation = (text) => {
  const locationPatterns = [
    /take\s+place\s+at\s+([^\.]+)/,
    /to\s+be\s+held\s+in\s+([^\.]+)/,
    /will\s+be\s+held\s+from\s+([^\.]+)/,
    /will\s+take\s+place\s+in\s+([^\.]+)/,
    /will\s+be\s+held\s+in\s+([^\.]+)/,
    /located\s+us\s+in\s+([^\.]+)/,
    /join\s+us\s+in\s+([^\.]+)/,
    /Location:\s+(.*)/,
    /will\s+be\s+held\s([^\.]+)/,
    /will\s+be\s+hosted\s+at\s+([^\.]+)/,
    /will\s+take\s+place\s+([^\.]+)/,
    /organized\s+at\s+([^\.]+)/,
    /taking\s+place\s+in\s+([^\.]+)/,
    /conducted\s+in\s+([^\.]+)/,

    /to\s+be\s+held\s+in\s+([^\.]+)/,

    //will take place in madrid
    /will take place in ([^,]+)/i,

    // 3. Mẫu "[dates] - [City, Country]"
    /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}(?:\s+to\s+\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})?)\s*-\s*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 8. Mẫu: "The [Title] Conference on [dates] in [City, Country]"
    /\b(?:The\s+\w+\s+Conference|Symposium|Workshop)\s+(?:on|at)\s+(?:\d{1,2}\s+\w+\s+\d{4}(?:\s+to\s+\d{1,2}\s+\w+\s+\d{4})?)\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 9. Mẫu "at the [City, Country]"
    /\bat\s+the\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 10. Mẫu "located in [City, Country]"
    /\blocated\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 11. Mẫu "[City, Country] where [event details]"
    /([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\s+where\s+\w+/g,

    // 12. Mẫu "held at [City, Country]"
    /\bheld\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 13. Mẫu "conducted in [City, Country]"
    /\bconducted\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 14. Mẫu "organized at [City, Country]"
    /\borganized\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 15. Mẫu "taking place in [City, Country]"
    /\btaking\s+place\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    //take place in [City]
    /\btake\s+place\s+in\s+\[([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)]/g,

    // 16. Mẫu "in the city of [City, Country]"
    /\bin\s+the\s+city\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 17. Mẫu "at the venue in [City, Country]"
    /\bat\s+the\s+venue\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 18. Mẫu "to be held in [City, Country]"
    /\bto\s+be\s+held\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z]{2},\s[A-Z]{3})/g,

    // 19. Mẫu "held at the [City, Country]"
    /\bheld\s+at\s+the\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 20. Mẫu "hosted in [City, Country]"
    /\bhosted\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 21. Mẫu "in the region of [City, Country]"
    /\bin\s+the\s+region\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 22. Mẫu "in the area of [City, Country]"
    /\bin\s+the\s+area\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 23. Mẫu "held in the city of [City, Country]"
    /\bheld\s+in\s+the\s+city\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 24. Mẫu "hosted at [City, Country]"
    /\bhosted\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 25. Mẫu "organized in [City, Country]"
    /\borganized\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 26. Mẫu "conference in [City, Country]"
    /\bconference\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 27. Mẫu "workshop in [City, Country]"
    /\bworkshop\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 28. Mẫu "symposium in [City, Country]"
    /\bsymposium\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 29. Mẫu "forum in [City, Country]"
    /\bforum\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 30. Mẫu "summit in [City, Country]"
    /\bsummit\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 31. Mẫu "colloquium in [City, Country]"
    /\bcolloquium\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 32. Mẫu "held at the venue in [City, Country]"
    /\bheld\s+at\s+the\s+venue\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 33. Mẫu "held in [City, Country] on [dates]"
    /\bheld\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\s+on\s+\d{1,2}\s+\w+\s+\d{4}/g,

    // 34. Mẫu "held at [City, Country] on [dates]"
    /\bheld\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\s+on\s+\d{1,2}\s+\w+\s+\d{4}/g,

    // 35. Mẫu "taking place at [City, Country]"
    /\btaking\s+place\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 36. Mẫu "hosted in the city of [City, Country]"
    /\bhosted\s+in\s+the\s+city\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 37. Mẫu "held in the area of [City, Country]"
    /\bheld\s+in\s+the\s+area\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 38. Mẫu "located at [City, Country]"
    /\blocated\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 39. Mẫu "held in the region of [City, Country]"
    /\bheld\s+in\s+the\s+region\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 40. Mẫu "taking place in the city of [City, Country]"
    /\btaking\s+place\s+in\s+the\s+city\s+of\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 41. Mẫu "to be conducted in [City, Country]"
    /\bto\s+be\s+conducted\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 42. Mẫu "to be organized at [City, Country]"
    /\bto\s+be\s+organized\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 43. Mẫu "to be hosted in [City, Country]"
    /\bto\s+be\s+hosted\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 44. Mẫu "to be held at [City, Country]"
    /\bto\s+be\s+held\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 45. Mẫu "to be organized in [City, Country]"
    /\bto\s+be\s+organized\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 46. Mẫu "scheduled to be held in [City, Country]"
    /\bscheduled\s+to\s+be\s+held\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 47. Mẫu "scheduled to be held at [City, Country]"
    /\bscheduled\s+to\s+be\s+held\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 48. Mẫu "to be hosted at [City, Country]"
    /\bto\s+be\s+hosted\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 49. Mẫu "scheduled in [City, Country]"
    /\bscheduled\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,

    // 50. Mẫu "scheduled at [City, Country]"
    /\bscheduled\s+at\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*,\s[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g,
  ];

  for (const pattern of locationPatterns) {
    const match = pattern.exec(text);
    if (match) {
      console.log("Matched pattern:", pattern, "match: ", match[1]);

      // remove exessive spaces and new lines
      let removedMatch = match[1].replace(/\s+/g, " ").trim();
      let location = removeDateAndFrom(removedMatch);
      console.log("Location after being trimmed: " + location);
      return location;
    }
  }
  return "";
};

module.exports = {
  getLocation,
  isInDict,
};