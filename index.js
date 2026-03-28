const mineflayer = require('mineflayer');
const chalk = require('chalk');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const http = require('http');

// --- 0. TẠO WEB SERVER ĐỂ GIỮ CODESPACE LUÔN THỨC ---
// GitHub Codespaces sẽ tự động tắt nếu không có hoạt động Web.
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Lucifer Bot is Running on Codespaces\n');
});

// Codespace thường dùng port 3000 hoặc 8080. Ở đây mình dùng port động.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(chalk.green(`[HỆ THỐNG] Web Server giữ sống chạy trên cổng ${PORT}`));
});

// --- 1. BỘ LỌC NHẬT KÝ ---
const originalStdout = process.stdout.write;
const filterSystemLogs = (chunk) => {
    const msg = chunk.toString();
    const blacklist = ['Chunk size', 'partial packet', 'entity_teleport', 'buffer :', 'params', 'entityId', 'unhandled packet'];
    return blacklist.some(term => msg.includes(term));
};
process.stdout.write = function (chunk, encoding, callback) {
    if (filterSystemLogs(chunk)) return;
    return originalStdout.apply(process.stdout, arguments);
};

// --- 2. CẤU HÌNH (FIX LỖI SOCKET CLOSED) ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487286375802998864/nQXjQ5QP09zfnFVzYvEzp-iRu-Tikxsc7SbqLv30kNSjIdmQ5P9z7igIBZ03UkGchZos';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });
let discordMsgId = null; 

const config = {
    host: 'aquamc.site', 
    port: 25565,
    username: 'thanhng65', 
    pass: '0866703869',
    version: '1.20.1', // Phiên bản ổn định nhất cho Mineflayer
    connectTimeout: 90000, // Tăng thời gian chờ lên 1.5 phút
    keepAlive: true,
    checkTimeoutInterval: 60000,
    // Thêm fakeHost giúp lách một số bộ lọc Anti-Bot đơn giản
    fakeHost: 'aquamc.site' 
};

// --- 3. BIẾN TRẠNG THÁI ---
let s = { login: 0, server: 0, home: 0, mining: 0, blocks: 0, foodLevel: 20, start: Date.now(), isTeleporting: false };

const addLog = (tag, msg, col) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    console.log(chalk[col](`[${time}] [${tag}] ${msg}`));
};

function createBot() {
    addLog('HỆ THỐNG', `Đang kết nối tới AquaMC qua Codespaces...`, 'yellow');
    
    const bot = mineflayer.createBot(config);

    // --- 4. CẬP NHẬT DISCORD ---
    const renderStats = async () => {
        if (!bot.players) return;
        const diff = Date.now() - s.start;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const sec = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        
        try {
            const embed = new EmbedBuilder()
                .setTitle('LUCIFER DASHBOARD - CODESPACES')
                .setColor(s.mining ? 0x00FF00 : 0xFFCC00)
                .addFields(
                    { name: '👤 Nick', value: `\`${config.username}\``, inline: true },
                    { name: '📡 Trạng thái', value: `**${s.isTeleporting ? "✈️ DỊCH CHUYỂN" : (s.mining ? "🟢 HOẠT ĐỘNG" : "🟠 ĐANG VÀO")}**`, inline: true },
                    { name: '⛏ Block', value: `\`${s.blocks.toLocaleString()}\``, inline: true },
                    { name: '⏱ Uptime', value: `\`${h}:${m}:${sec}\``, inline: true }
                ).setTimestamp();
            
            if (!discordMsgId) {
                const message = await webhook.send({ embeds: [embed] });
                discordMsgId = message.id;
            } else {
                await webhook.editMessage(discordMsgId, { embeds: [embed] });
            }
        } catch (e) {}
    };
    setInterval(renderStats, 30000);

    // --- 5. LOGIC GAME ---
    bot.on('connect', () => addLog('HỆ THỐNG', 'Kết nối thành công tới Server!', 'green'));

    bot.on('spawn', async () => {
        if (s.login) return;
        addLog('GAME', 'Đã vào sảnh. Đang chờ 10 giây để Login...', 'cyan');
        await new Promise(r => setTimeout(r, 10000));
        bot.chat(`/login ${config.pass}`);
        s.login = 1;

        await new Promise(r => setTimeout(r, 8000));
        addLog('GAME', 'Đang vào Skyblock...', 'magenta');
        bot.chat('/server skyblock');
        s.server = 1;

        await new Promise(r => setTimeout(r, 15000));
        addLog('HÀNH ĐỘNG', 'Đang về đảo (/home)...', 'yellow');
        s.isTeleporting = true;
        bot.chat('/home');
        
        await new Promise(r => setTimeout(r, 20000)); // Chờ lâu hơn phòng lag
        s.isTeleporting = false;
        s.home = 1; s.mining = 1;
        addLog('HỆ THỐNG', 'BẮT ĐẦU ĐÀO ĐÁ!', 'green');
        startMining(bot);
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
                await new Promise(r => setTimeout(r, 350)); // Chậm lại một chút để tránh Anti-cheat
            }
        }
    }

    // Tự động ăn
    setInterval(async () => {
        if (!bot.entity || s.isTeleporting) return;
        if (bot.food <= 14) {
            const food = bot.inventory.items().find(i => 
                ['beef', 'bread', 'apple', 'steak', 'pork', 'cooked', 'potato'].some(n => i.name.includes(n))
            );
            if (food) {
                const wasMining = s.mining; s.mining = 0;
                try {
                    await bot.equip(food, 'hand');
                    await bot.consume();
                } catch {} finally {
                    s.mining = wasMining;
                    if (s.mining) startMining(bot);
                }
            }
        }
    }, 25000);

    bot.on('error', (err) => {
        addLog('LỖI', err.message, 'red');
    });

    bot.on('end', (reason) => {
        addLog('HỆ THỐNG', `Mất kết nối: ${reason}. Thử lại sau 15s...`, 'red');
        s = { login: 0, server: 0, home: 0, mining: 0, blocks: s.blocks, start: s.start, isTeleporting: false };
        setTimeout(createBot, 15000);
    });
}

createBot();
