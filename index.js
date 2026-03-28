const mineflayer = require('mineflayer');
const chalk = require('chalk');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const http = require('http');

// --- 0. GIỮ BOT LUÔN SỐNG TRÊN RENDER ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Lucifer Bot is Online\n');
});
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(chalk.green(`[HỆ THỐNG] Web Server chạy trên cổng ${PORT}`));
});

// --- 1. BỘ LỌC LOG ---
const originalStdout = process.stdout.write;
const filterSystemLogs = (chunk) => {
    const msg = chunk.toString();
    const blacklist = ['Chunk size', 'partial packet', 'entity_teleport', 'buffer :', 'params', 'entityId'];
    return blacklist.some(term => msg.includes(term));
};
process.stdout.write = function (chunk, encoding, callback) {
    if (filterSystemLogs(chunk)) return;
    return originalStdout.apply(process.stdout, arguments);
};

// --- 2. CẤU HÌNH ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487286375802998864/nQXjQ5QP09zfnFVzYvEzp-iRu-Tikxsc7SbqLv30kNSjIdmQ5P9z7igIBZ03UkGchZos';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });
let discordMsgId = null; 

const config = {
    host: 'aquamc.site', 
    port: 25565,
    username: 'thanhng65', 
    pass: '0866703869',
    version: false, // Tự động dò phiên bản server
    connectTimeout: 60000 // Tăng thời gian chờ lên 60s phòng lag
};

// --- 3. BIẾN TRẠNG THÁI ---
let s = { login: 0, server: 0, home: 0, mining: 0, blocks: 0, foodLevel: 20, start: Date.now(), players: 0, isTeleporting: false };
let allLogs = [];

const addLog = (tag, msg, col) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    console.log(`${chalk[col](`[${tag}]`)} ${msg}`); // Hiện log ra Render để dễ check
    if (msg.includes('§') || msg.length > 90 || msg.trim() === "") return;
    allLogs.push(`${chalk.gray(time)} ${chalk[col].bold(`[${tag}]`)} ${chalk.white(msg.trim())}`);
    if (allLogs.length > 15) allLogs.shift();
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const equipPickaxe = async (bot) => {
    const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
    if (pickaxe) {
        try { await bot.equip(pickaxe, 'hand'); } catch (err) {}
    }
};

function createBot() {
    addLog('HỆ THỐNG', `Đang thử kết nối tới ${config.host}...`, 'yellow');
    const bot = mineflayer.createBot(config);

    // --- 4. DASHBOARD DISCORD ---
    const renderStats = async () => {
        const diff = Date.now() - s.start;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const sec = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        const timeBot = `${h}:${m}:${sec}`;
        s.players = bot.players ? Object.keys(bot.players).length : 0;
        s.foodLevel = bot.food || 0;

        try {
            const embed = new EmbedBuilder()
                .setTitle('LUCIFER BOT - RENDER CLOUD')
                .setColor(s.mining ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: '👤 Tài khoản', value: `\`${config.username}\``, inline: true },
                    { name: '📡 Trạng thái', value: `**${s.isTeleporting ? "✈️ DỊCH CHUYỂN" : (s.mining ? "🟢 HOẠT ĐỘNG" : "🔴 TẠM DỪNG")}**`, inline: true },
                    { name: '⛏ Số Block', value: `\`${s.blocks.toLocaleString()}\``, inline: true },
                    { name: '⏱ Uptime', value: `\`${timeBot}\``, inline: true }
                ).setTimestamp();
            if (!discordMsgId) {
                const message = await webhook.send({ embeds: [embed] });
                discordMsgId = message.id;
            } else {
                await webhook.editMessage(discordMsgId, { embeds: [embed] });
            }
        } catch (err) {}
    };
    setInterval(renderStats, 30000); 

    // --- 5. LOGIC KẾT NỐI ---
    bot.on('connect', () => addLog('HỆ THỐNG', 'Đã chạm được server AquaMC!', 'green'));

    bot.on('spawn', async () => {
        if (s.login) return;
        addLog('HỆ THỐNG', 'Vào game thành công. Đang login...', 'cyan');
        await sleep(6000); bot.chat(`/login ${config.pass}`);
        s.login = 1; await sleep(6000); bot.chat('/server skyblock');
        s.server = 1; await sleep(12000); 

        addLog('HÀNH ĐỘNG', 'Thực hiện /home. Chờ 17s...', 'yellow');
        s.isTeleporting = true;
        bot.chat('/home');
        
        await sleep(18000); 
        s.isTeleporting = false;
        s.home = 1; s.mining = 1;
        addLog('HỆ THỐNG', 'Bắt đầu đào đá!', 'green');
        startMining(bot);
    });

    bot.on('messagestr', (msg) => {
        if (msg.trim()) console.log(chalk.blue(`[CHAT] ${msg.trim()}`));
    });

    async function startMining(bot) {
        while (s.mining && !s.isTeleporting) {
            const block = bot.blockAtCursor(4);
            if (block && block.name !== 'air') {
                try {
                    bot.swingArm('left');
                    await bot.dig(block, true);
                    s.blocks++;
                } catch {}
            } else {
                bot.swingArm('left');
                await sleep(250);
            }
        }
    }

    // Tự động ăn
    setInterval(async () => {
        if (!bot.entity || s.isTeleporting) return;
        if (bot.food <= 14) {
            const food = bot.inventory.items().find(i =>
                ['beef', 'bread', 'apple', 'steak', 'pork', 'mutton', 'chicken', 'cooked', 'potato'].some(n => i.name.includes(n))
            );
            if (food) {
                const wasMining = s.mining; s.mining = 0; 
                try {
                    await bot.equip(food, 'hand');
                    await bot.consume();
                } catch (e) {} finally {
                    await equipPickaxe(bot);
                    s.mining = wasMining;
                    if (s.mining) startMining(bot);
                }
            }
        }
    }, 25000);

    bot.on('error', (e) => addLog('LỖI', e.message, 'red'));
    bot.on('end', (reason) => {
        addLog('HỆ THỐNG', `Mất kết nối: ${reason}. Thử lại sau 15s...`, 'red');
        s = { ...s, login: 0, server: 0, home: 0, mining: 0, isTeleporting: false };
        setTimeout(createBot, 15000);
    });
}

createBot();
