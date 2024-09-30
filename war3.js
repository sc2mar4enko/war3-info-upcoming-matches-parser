const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({headless: false, defaultViewport: null, args: ['--start-maximized']});
    // const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const pageUrl = 'https://warcraft3.info/';
    await page.goto(pageUrl);

    // const table = await page.$$('.ticker');

    const matchRows = await page.$$('.ticker .layout-striped-row');

    const matches = [];

    let breaker = false;

    for (const row of matchRows) {
        if (breaker) break;
        const matchInfo = await row.evaluate(el => {
            const matchDetails = el.querySelector('.match-link.row.ticker-row.align-items-start');
            if (matchDetails) {
                const date = el.querySelector('.custom-col.date-col > span > span > span');
                if (date && date.textContent) {
                    const matchLink = matchDetails.getAttribute('href')
                    const scores = el.querySelectorAll('.custom-col.score-col > div > span');
                    const scoreArray = Array.from(scores).map(span => span.textContent.trim()).join('');
                    const player1 = matchDetails.querySelector('.custom-col.player-col > span')?.textContent.trim() || null;
                    const score = scoreArray;
                    const player2 = matchDetails.querySelector('.custom-col.player-col.player-right > span').textContent.trim() || null;
                    return {
                        player1, score: scoreArray, player2, matchLink: `https://warcraft3.info${matchLink}`
                    };
                }
            }
            return null;
        });

        if (matchInfo) {
            // breaker = true;
            const statsPage = await browser.newPage();
            await statsPage.goto(matchInfo.matchLink);
            await statsPage.waitForSelector('.btn.neutral-button');
            const hasIcon = await statsPage.$eval('.btn.neutral-button', button => {
                const icon = button.querySelector('.fas.fa-chart-line');
                return icon !== null && !button.classList.contains('active');
            });
            if (hasIcon) {
                await statsPage.click('.btn.neutral-button')
            }
            await statsPage.waitForSelector('.stats-versus .history-table .table-responsive .table.b-table.table-striped.table-hover.table-sm tbody');
            const tbody = await statsPage.$('.stats-versus .history-table .table-responsive .table.b-table.table-striped.table-hover.table-sm tbody');
            const rows = await tbody.$$('tr');

            let p1scores = [];
            let p2scores = [];
            let recentPlayerScore = [];

            for (let i = 0; i < Math.min(8, rows.length); i++) {
                const dateCell = await rows[i].$('td:nth-child(1) > span');
                const dateText = await statsPage.evaluate(el => el.textContent, dateCell);
                const fifthCell = await rows[i].$('td:nth-child(5)');
                const linkElement = await fifthCell.$('a');
                const scoreSpans = await linkElement.$$('div > span');
                const scoreArray = await Promise.all(scoreSpans.map(async (span) => {
                    return await statsPage.evaluate(el => el.textContent.trim(), span);
                }));
                scoreArray.push(dateText);
                if (scoreArray[0]) {
                    p1scores.push(parseInt(scoreArray[0]) || 0);
                }
                if (scoreArray[2]) {
                    p2scores.push(parseInt(scoreArray[2]) || 0);
                }
                // console.log(scoreArray);
                const p1sum = p1scores.reduce((acc, val) => acc + val, 0);
                const p2sum = p2scores.reduce((acc, val) => acc + val, 0);
                recentPlayerScore = [p1sum, p2sum];
            }
            // console.log(recentPlayerScore);
            matches.push(matchInfo);
            matchInfo.recentPlayerScore = recentPlayerScore.join(':');
        }
    }
    console.log(matches);
    const upcomingMatches = matches.map(match => `${match.player1} vs ${match.player2} ${match.matchLink} ${match.recentPlayerScore}`).join('\n');
    console.log('asdhjlfjasldhfhjlkasdf');
    console.log(upcomingMatches);
    fs.writeFile('upcoming_matches.txt', upcomingMatches, err => {});
    await browser.close();
})()