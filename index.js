const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const autoeat = require('mineflayer-auto-eat').plugin;
const pvp = require('mineflayer-pvp').plugin;
const armorManager = require('mineflayer-armor-manager');
const collectBlock = require('mineflayer-collectblock').plugin;
const toolPlugin = require('mineflayer-tool').plugin;
const { Vec3 } = require('vec3');

const admins = ['longdzzz', 'csu be long'];
let bot, botState = 'idle', idleStart = null;

function startBot() {
  bot = mineflayer.createBot({
    host: 'longdzzz.aternos.me',
    port: 50567, // ✅ đã thay đúng port
    username: 'botuia'
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(autoeat);
  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(toolPlugin);

  bot.once('spawn', () => {
    bot.chat('✅ Bot đã online!');
    idleStart = Date.now();
    bot.autoEat.options = { priority: 'foodPoints', startAt: 16 };
    bot.pathfinder.setMovements(new Movements(bot));
  });

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    const isAdmin = admins.includes(username);

    if (message === 'bot menu') {
      if (!isAdmin) return bot.chat('⛔ Chỉ admin được mở menu!');
      bot.chat('📜 Menu BOT UIA:');
      bot.chat('[1] 🗡️ PvP như hack');
      bot.chat('[2] 🧟 Farm XP từ quái');
      bot.chat('[3] ✨ Enchant');
      bot.chat('[4] 🛠️ Craft đồ thiếu');
      bot.chat('[5] 🔥 Tìm Netherite');
      bot.chat('[6] 🏰 Tìm Bastion');
      bot.chat('[7] 🛡️ Nâng cấp gear');
      bot.chat('[8] 🧱 Xây logo UIA');
      bot.chat('[9] 📦 Mở túi đồ & rương');
      bot.chat('[10] ❌ Thoát menu');
      botState = 'menu';
      return;
    }

    if (botState === 'menu') {
      switch (message) {
        case '1': bot.chat('🗡️ Gõ "solo bot" để PvP'); break;
        case '2': const mob = bot.nearestEntity(e => e.type === 'mob'); if (mob) bot.pvp.attack(mob); else bot.chat('❌ Không có mob.'); break;
        case '3': bot.chat('✨ Giả lập Enchant'); break;
        case '4': await craftMissingTools(); break;
        case '5': await startNetheriteRun(); break;
        case '6': bot.chat('🏰 Loot Smithing Template từ Bastion (giả lập)'); break;
        case '7': await upgradeGearToNetherite(); break;
        case '8': await buildUIALogo(); break;
        case '9': showInventoryAndChest(); break;
        case '10': bot.chat('❌ Menu đóng.'); botState = 'idle'; break;
        default: bot.chat('❓ Nhập từ 1–10.');
      }
      return;
    }

    if (message.toLowerCase().includes('solo bot')) {
      const target = bot.players[username]?.entity;
      if (!target) return bot.chat('❌ Không thấy bạn gần.');
      bot.chat('🗡️ 1... 2... 3 PvP!');
      await equipBestWeapon();
      bot.pvp.attack(target);
    }
  });

  bot.on('physicTick', async () => {
    if (botState === 'menu' || bot.pvp.target) return;
    if (bot.entity.isInWater) return bot.setControlState('jump', true);

    const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    if (blockBelow?.name === 'lava') {
      bot.setControlState('jump', true);
      bot.setControlState('forward', true);
      return;
    }

    const mob = bot.nearestEntity(e => e.type === 'mob');
    if (mob) return bot.pvp.attack(mob);

    if (bot.inventory.items().length >= 32) return bot.chat('/home');

    if (Math.random() < 0.01) await mimicNearestPlayer();

    if (Date.now() - idleStart > 30000) {
      await buildUIALogo();
      idleStart = Date.now();
    }
  });

  bot.on('entityHurt', entity => {
    if (entity === bot.entity) {
      bot.chat('⚠️ Bị tấn công! Phản công ngay!');
      const attacker = bot.nearestEntity(e => e.type === 'player' && e !== bot.entity);
      if (attacker) bot.pvp.attack(attacker);
    }
  });

  bot.on('blockUpdate', (oldBlock, newBlock) => {
    if (botState === 'building' && newBlock && newBlock.name === 'air') {
      const player = bot.nearestEntity(e => e.type === 'player' && e !== bot.entity);
      if (player) {
        bot.chat('⚠️ Ai đó phá đồ đang xây, phản đòn!');
        bot.pvp.attack(player);
      }
    }
  });

  async function craftMissingTools() {
    const tools = ['pickaxe', 'axe', 'shovel', 'sword'];
    const mats = ['diamond', 'iron', 'stone', 'wood'];
    for (let tool of tools) {
      const has = bot.inventory.items().some(i => i.name.includes(tool));
      if (!has) {
        for (let mat of mats) {
          const name = `${mat}_${tool}`;
          const id = bot.registry.itemsByName[name]?.id;
          const recipe = id ? bot.recipesFor(id)?.[0] : null;
          if (recipe) {
            bot.chat(`🛠️ Craft ${name}...`);
            await bot.craft(recipe, 1, null);
            break;
          }
        }
      }
    }
  }

  async function equipBestWeapon() {
    const sword = bot.inventory.items().find(i => i.name.includes('sword'));
    if (sword) await bot.equip(sword, 'hand');
    await bot.armorManager.equipAll();
  }

  async function buildUIALogo() {
    botState = 'building';
    const base = bot.entity.position.floored().offset(2, 0, 0);
    const block = bot.inventory.items().find(i => i.name.includes('stone') || i.name.includes('dirt'));
    if (!block) return;
    await bot.equip(block, 'hand');
    const letters = [
      [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[2,1],[2,2],[2,3],[2,4]],
      [[4,0],[4,1],[4,2],[4,3],[4,4]],
      [[6,0],[6,1],[6,2],[6,3],[6,4],[8,0],[8,1],[8,2],[8,3],[8,4],[7,2]]
    ];
    for (let letter of letters) {
      for (let [dx, dy] of letter) {
        const pos = base.offset(dx, dy, 0);
        const ref = bot.blockAt(pos.offset(0, -1, 0));
        if (ref) try { await bot.placeBlock(ref, new Vec3(0, 1, 0)); } catch {}
      }
    }
    bot.chat('✅ Logo UIA đã xây xong!');
    botState = 'idle';
  }

  async function startNetheriteRun() {
    const obs = bot.inventory.items().filter(i => i.name === 'obsidian');
    if (obs.length < 10) return bot.chat('❌ Không đủ obsidian!');
    const base = bot.entity.position.floored().offset(3, 0, 0);
    const frame = [...Array(5).fill().map((_, i) => [0, i]), ...Array(5).fill().map((_, i) => [2, i]), [1,0],[1,4]];
    await bot.equip(obs[0], 'hand');
    for (let [dx, dy] of frame) {
      const ref = bot.blockAt(base.offset(dx, dy - 1, 0));
      if (ref) try { await bot.placeBlock(ref, new Vec3(0, 1, 0)); } catch {}
    }

    const lighter = bot.inventory.items().find(i => i.name === 'flint_and_steel');
    if (lighter) {
      await bot.equip(lighter, 'hand');
      await bot.activateBlock(bot.blockAt(base.offset(1, 0, 0)));
      bot.chat('🌀 Cổng Nether đã bật!');
      setTimeout(() => bot.setControlState('forward', true), 2000);
    } else {
      bot.chat('❌ Không có bật lửa!');
    }
  }

  async function upgradeGearToNetherite() {
    const table = bot.findBlock({ matching: b => b.name === 'smithing_table', maxDistance: 16 });
    const template = bot.inventory.items().find(i => i.name.includes('smithing_template'));
    const ingot = bot.inventory.items().find(i => i.name === 'netherite_ingot');
    const gear = bot.inventory.items().find(i => i.name.includes('diamond_') && i.name !== 'diamond');
    if (!table || !template || !ingot || !gear) return bot.chat('❌ Thiếu đồ nâng cấp!');
    const win = await bot.openBlock(bot.blockAt(table.position));
    try {
      await win.putInput(0, gear.type, null, 1);
      await win.putInput(1, template.type, null, 1);
      await win.putInput(2, ingot.type, null, 1);
      bot.chat('✅ Đã nâng cấp Netherite!');
      win.close();
    } catch (err) {
      bot.chat('⚠️ Lỗi nâng cấp: ' + err.message);
      win.close();
    }
  }

  async function mimicNearestPlayer() {
    const target = bot.nearestEntity(e => e.type === 'player' && e.username !== bot.username);
    if (!target) return;
    const pos = target.position.offset(0, 0, 0);
    const action = Math.random();
    if (action < 0.3) {
      bot.chat(`👣 Theo ${target.username}`);
      bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, 2));
    } else if (action < 0.6) {
      bot.lookAt(pos);
    } else if (action < 0.9) {
      const block = bot.blockAt(pos.offset(0, -1, 0));
      if (block?.dig) {
        bot.chat('⛏️ Bắt chước đào...');
        try { await bot.dig(block); } catch {}
      }
    } else {
      bot.chat('🤨 Đứng nhìn...');
    }
  }

  function showInventoryAndChest() {
    const items = bot.inventory.items().map(i => `${i.count}x ${i.displayName}`).join(', ');
    bot.chat('🎒 Túi đồ: ' + (items || 'Trống'));
    const chest = bot.currentWindow;
    if (chest) {
      const chestItems = chest.slots.filter(i => i).map(i => `${i.count}x ${i.displayName}`).join(', ');
      bot.chat('📦 Rương: ' + (chestItems || 'Trống'));
    }
  }

  bot.on('end', () => {
    console.log('💤 Bot bị kick. Reconnect sau 200s...');
    setTimeout(startBot, 200000);
  });

  bot.on('error', err => {
    console.log('❗ Bot lỗi:', err);
    setTimeout(startBot, 200000);
  });
}

startBot();
