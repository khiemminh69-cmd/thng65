const mineflayer = require('mineflayer');
const chalk = require('chalk');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const http = require('http');

// --- 0. WEB SERVER GIỮ SỐNG ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Lucifer Bot 24/7 Online\n');
}).listen(process.env.PORT || 10000);

// --- 1. BỘ LỌC LOG ---
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

// --- 2. CẤU HÌNH (ĐÃ FIX VERSION) ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487286375802998864/nQXjQ5QP09zfnFVzYvEzp-iRu-Tikxsc7SbqLv30kNSjIdmQ5P9z7igIBZ03UkGchZos';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });
let discordMsgId = null; 

const config = {
    host: 'aquamc.site', 
    port: 25565,
    username: 'thanhng65', 
    pass: '0866703869',
    version: '1.20.1', // Ép về 1.20.1 để tránh lỗi Socket
    connectTimeout: 60000,
    keepAlive: true,
    hideErrors: true
};

// --- 3. BIẾN TRẠNG THÁI ---
let s = { login: 0, server: 0, home: 0, mining: 0, blocks: 0, foodLevel: 20, start: Date.now(), isTeleporting: false };

const addLog = (tag, msg, col) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    console.log(chalk[col](`[${time}] [${tag}] ${msg}`));
};

function createBot() {
    addLog('HỆ THỐNG', `Đang kết nối tới AquaMC (Ver: ${config.version})...`, 'yellow');
    
    const bot = mineflayer.createBot(config);

    // --- 4. DISCORD DASHBOARD ---
    const renderStats = async () => {
        if (!bot.players) return;
        const diff = Date.now() - s.start;
        const timeBot = new Date(diff).toISOString().substr(11, 8);
        
        try {
            const embed = new EmbedBuilder()
                .setTitle('LUCIFER DASHBOARD - RENDER')
                .setColor(s.mining ? 0x00FF00 : 0xFFAA00)
                .addFields(
                    { name: '👤 Nick', value: `\`${config.username}\``, inline: true },
                    { name: '📡 Trạng thái', value: `**${s.isTeleporting ? "✈️ DỊCH CHUYỂN" : (s.mining ? "🟢 ĐANG ĐÀO" : "🟠 CHỜ ĐĂNG NHẬP")}**`, inline: true },
                    { name: '⛏ Khối đá', value: `\`${s.blocks.toLocaleString()}\``, inline: true },
                    { name: '⏱ Thời gian', value: `\`${timeBot}\``, inline: true }
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
    bot.on('connect', () => addLog('HỆ THỐNG', 'Đã bắt tín hiệu server!', 'green'));

    bot.on('spawn', async () => {
        if (s.login) return;
        addLog('GAME', 'Đã Spawn! Chờ 8 giây để Login...', 'cyan');
        await new Promise(r => setTimeout(r, 8000));
        bot.chat(`/login ${config.pass}`);
        s.login = 1;

        await new Promise(r => setTimeout(r, 8000));
        addLog('GAME', 'Đang chuyển vùng Skyblock...', 'magenta');
        bot.chat('/server skyblock');
        s.server = 1;

        await new Promise(r => setTimeout(r, 12000));
        addLog('HÀNH ĐỘNG', 'Đang về /home (Chờ 18s)...', 'yellow');
        s.isTeleporting = true;
        bot.chat('/home');
        
        await new Promise(r => setTimeout(r, 18000));
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
                await new Promise(r => setTimeout(r, 300));
            }
        }
    }

    // Auto Eat
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
    }, 20000);

    bot.on('messagestr', (msg) => {
        if (msg.includes('đăng nhập thành công') || msg.includes('chào mừng')) {
            addLog('CHAT', 'Đã đăng nhập thành công!', 'green');
        }
    });

    bot.on('error', (err) => {
        if (err.message.includes('socketClosed')) {
            addLog('LỖI', 'Server ngắt kết nối (socketClosed). Có thể do Anti-Bot hoặc Version.', 'red');
        } else {
            addLog('LỖI', err.message, 'red');
        }
    });

    bot.on('end', (reason) => {
        addLog('HỆ THỐNG', `Bot dừng: ${reason}. Thử lại sau 20s...`, 'red');
        s = { login: 0, server: 0, home: 0, mining: 0, blocks: s.blocks, start: s.start, isTeleporting: false };
        setTimeout(createBot, 20000);
    });
}

createBot();
