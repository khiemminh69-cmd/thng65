const mineflayer = require('mineflayer');
const chalk = require('chalk');
const { WebhookClient, EmbedBuilder } = require('discord.js');

// --- 1. BỘ LỌC TRIỆT ĐỂ: XÓA LỖI CHUNK / TELEPORT / BUFFER RÁC ---
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;
const filterSystemLogs = (chunk) => {
    const msg = chunk.toString();
    const blacklist = ['Chunk size', 'partial packet', 'entity_teleport', 'buffer :', 'params', 'entityId'];
    return blacklist.some(term => msg.includes(term));
};
process.stdout.write = function (chunk, encoding, callback) {
    if (filterSystemLogs(chunk)) return;
    return originalStdout.apply(process.stdout, arguments);
};
process.stderr.write = function (chunk, encoding, callback) {
    if (filterSystemLogs(chunk)) return;
    return originalStderr.apply(process.stderr, arguments);
};

// --- 2. CẤU HÌNH ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487286375802998864/nQXjQ5QP09zfnFVzYvEzp-iRu-Tikxsc7SbqLv30kNSjIdmQ5P9z7igIBZ03UkGchZos';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });
let discordMsgId = null; 

const config = {
    host: 'aquamc.site', port: 25565,
    username: 'thanhng65', pass: '0866703869',
    version: '1.21.4'
};

// --- 3. BIẾN TRẠNG THÁI ---
let s = { login: 0, server: 0, home: 0, mining: 0, blocks: 0, foodLevel: 20, start: Date.now(), players: 0, isTeleporting: false };
let allLogs = [];

const addLog = (tag, msg, col) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    if (msg.includes('§') || msg.length > 90 || msg.trim() === "") return;
    allLogs.push(`${chalk.gray(time)} ${chalk[col].bold(`[${tag}]`)} ${chalk.white(msg.trim())}`);
    if (allLogs.length > 20) allLogs.shift();
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const equipPickaxe = async (bot) => {
    const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
    if (pickaxe) {
        try { await bot.equip(pickaxe, 'hand'); } catch (err) {}
    }
};

function createBot() {
    const bot = mineflayer.createBot(config);

    // --- 4. GIAO DIỆN DASHBOARD ---
    const render = async () => {
        process.stdout.write('\x1B[H\x1B[2J\x1B[3J');
        const diff = Date.now() - s.start;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const sec = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        const timeBot = `${h}:${m}:${sec}`;

        s.players = Object.keys(bot.players).length;
        s.foodLevel = bot.food || 0;

        console.log(chalk.bgCyan.black.bold(`  BẢNG ĐIỀU KHIỂN LUCIFER  `) + chalk.bgWhite.black.bold(` PHIÊN BẢN 30.0 `));
        console.log("");

        // Hiển thị trạng thái thông minh
        let statusStr;
        if (s.isTeleporting) {
            statusStr = chalk.bgYellow.black.bold(' ✈️  ĐANG DỊCH CHUYỂN (15S) ');
        } else if (s.mining) {
            statusStr = chalk.bgGreen.black.bold(' ⛏  ĐANG HOẠT ĐỘNG ');
        } else {
            statusStr = chalk.bgRed.white.bold(' 🛑 ĐANG TẠM DỪNG ');
        }

        const foodDisplay = s.foodLevel <= 12 ? chalk.red.bold(`${s.foodLevel}/20`) : chalk.white(`${s.foodLevel}/20`);

        console.log(`${chalk.cyan('  👤 TÀI KHOẢN :')} ${chalk.white(config.username.padEnd(15))} ${chalk.cyan('👥 TRỰC TUYẾN :')} ${chalk.white(s.players)}`);
        console.log(`${chalk.cyan('  ⛏  SỐ BLOCK  :')} ${chalk.white(s.blocks.toLocaleString().padEnd(15))} ${chalk.cyan('📡 TRẠNG THÁI :')} ${statusStr}`);
        console.log(`${chalk.cyan('  🍱 ĐỘ ĐÓI    :')} ${foodDisplay.padEnd(22)} ${chalk.cyan('   🔗 MÁY CHỦ    :')} ${chalk.white(config.host)}`);
        console.log(`${chalk.cyan('  ⏱  THỜI GIAN :')} ${chalk.white(timeBot)}`);
        console.log("");
        console.log(chalk.cyan.bold(`  NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG :`));
        console.log(chalk.gray(`  ─────────────────────────────────────────────────────────────────────────`));
        allLogs.forEach(l => console.log('   ' + l));
        console.log(chalk.gray(`  ─────────────────────────────────────────────────────────────────────────`));

        try {
            const embed = new EmbedBuilder()
                .setTitle('DASHBOARD')
                .setColor(s.mining ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: '👤 Tài khoản', value: `\`${config.username}\``, inline: true },
                    { name: '📡 Trạng thái', value: `**${s.isTeleporting ? "✈️ DỊCH CHUYỂN" : (s.mining ? "🟢 HOẠT ĐỘNG" : "🔴 TẠM DỪNG")}**`, inline: true },
                    { name: '⛏ Số Block', value: `\`${s.blocks.toLocaleString()}\``, inline: true },
                    { name: '⏱ Thời gian', value: `\`${timeBot}\``, inline: true }
                ).setTimestamp();
            if (!discordMsgId) {
                const message = await webhook.send({ embeds: [embed] });
                discordMsgId = message.id;
            } else {
                await webhook.editMessage(discordMsgId, { embeds: [embed] });
            }
        } catch (err) {}
    };

    setInterval(render, 1000); 

    // --- 5. LOGIC KHỞI ĐỘNG (FIX CHỜ 15S) ---
    bot.on('spawn', async () => {
        if (s.login) return;
        addLog('HỆ THỐNG', 'Kết nối thành công.', 'cyan');
        await sleep(6000); bot.chat(`/login ${config.pass}`);
        s.login = 1; await sleep(6000); bot.chat('/server skyblock');
        s.server = 1; await sleep(10000); 

        // Bắt đầu dịch chuyển về home
        addLog('HÀNH ĐỘNG', 'Đang thực hiện /home. Chờ 15 giây...', 'yellow');
        s.isTeleporting = true;
        bot.chat('/home');
        
        // Chờ 17 giây (15s quy định + 2s dự phòng lag)
        await sleep(17000); 
        
        s.isTeleporting = false;
        s.home = 1;
        s.mining = 1;
        addLog('HỆ THỐNG', 'Đã về đảo. Bắt đầu đào!', 'green');
        startMining(bot);
    });

    bot.on('messagestr', (msg) => {
        addLog(s.server ? 'SKYBLOCK' : 'SẢNH CHỜ', msg, s.server ? 'yellow' : 'blue');
    });

    async function startMining(bot) {
        // Chỉ đào khi đang bật mining và KHÔNG trong lúc dịch chuyển
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
                await sleep(200);
            }
        }
    }

    // --- 6. AUTO EAT & CẦM LẠI CÚP ---
    setInterval(async () => {
        if (!bot.entity || s.isTeleporting) return;
        if (bot.food <= 14) {
            const food = bot.inventory.items().find(i =>
                ['beef', 'bread', 'apple', 'steak', 'pork', 'mutton', 'chicken', 'cooked', 'golden_apple', 'potato'].some(n => i.name.includes(n))
            );
            if (food) {
                const wasMining = s.mining; 
                s.mining = 0; 
                addLog('HÀNH ĐỘNG', `Đang ăn hồi phục...`, 'magenta');
                try {
                    await bot.equip(food, 'hand');
                    await bot.consume();
                    addLog('HÀNH ĐỘNG', `Ăn xong! Đang quay lại đào...`, 'green');
                } catch (e) {} finally {
                    await equipPickaxe(bot);
                    s.mining = wasMining;
                    if (s.mining) startMining(bot);
                }
            }
        }
    }, 15000);

    bot.on('resourcePack', () => bot.acceptResourcePack());
    bot.on('error', (e) => {
        if (!e.message.includes('Chunk size')) addLog('LỖI', e.message, 'red');
    });
    bot.on('end', () => {
        s = { ...s, login: 0, server: 0, home: 0, mining: 0, isTeleporting: false };
        setTimeout(createBot, 15000);
    });
}

createBot();
