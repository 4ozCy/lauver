require("dotenv").config();

const {
  Client, GatewayIntentBits, Partials, Collection,
  MessageFlags, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActivityType, PermissionFlagsBits,
} = require("discord.js");

const https  = require("https");
const http   = require("http");
const crypto = require("crypto");
const { Kazagumo, Payload, Plugins } = require("kazagumo");
const { Connectors } = require("shoukaku");

const TOKEN  = process.env.TOKEN;
const PREFIX = ".";
const OWNER  = "1107744228773220473";

if (!TOKEN) { console.error("Missing TOKEN"); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

const LAVA_NODES = [
  {
    host: "217.154.201.164",
    port: 5023,
    password: "3302",
    secure: false
  }
];

const kazagumo = new Kazagumo({
  defaultSearchEngine: "youtube",
  send: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
}, new Connectors.DiscordJS(client), LAVA_NODES);

kazagumo.shoukaku.on("error", (name, err) => console.error("[LAVALINK]", name, err.message));

const whitelist      = new Set([OWNER]);
const cooldowns      = new Collection();
const afkStore       = new Collection();
const snipeStore     = new Collection();
const esnipeStore    = new Collection();
const reminders      = [];
const notes          = new Collection();
const tags           = new Collection();
const pendingConfirm = new Collection();
const pageStore      = new Collection();

const F  = MessageFlags.IsComponentsV2;
const mc = (color = 0x5865f2) => new ContainerBuilder().setAccentColor(color);
const tx = (s) => new TextDisplayBuilder().setContent(s);
const sp = () => new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);

const send    = (ch, c, extra = []) => ch.send({ components: [c, ...extra], flags: F, allowedMentions: { parse: [] } });
const sendErr = (ch, m) => { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  " + m)); return send(ch, c); };
const sendOk  = (ch, m) => { const c = mc(0x57f287); c.addTextDisplayComponents(tx(m)); return send(ch, c); };
const eph     = (c) => ({ components: [c], flags: F | MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

const hasPerm = (m, ...f) => f.every(p => m.permissions.has(p));

const cooldown = (uid, name, secs = 2) => {
  const key = uid + ":" + name, now = Date.now();
  if (cooldowns.has(key)) {
    const exp = cooldowns.get(key);
    if (now < exp) return Math.ceil((exp - now) / 1000);
  }
  cooldowns.set(key, now + secs * 1000);
  return 0;
};

const fmtDur = (ms) => {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d) return d + "d " + (h % 24) + "h " + (m % 60) + "m";
  if (h) return h + "h " + (m % 60) + "m " + (s % 60) + "s";
  if (m) return m + "m " + (s % 60) + "s";
  return s + "s";
};

const parseTime = (s) => {
  const m = s?.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;
  return parseInt(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2].toLowerCase()];
};

const fetchJSON = (url) => new Promise((resolve, reject) => {
  const mod = url.startsWith("https") ? https : http;
  mod.get(url, { headers: { "User-Agent": "UtilityBot/1.0" } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
      return fetchJSON(res.headers.location).then(resolve).catch(reject);
    let d = "";
    res.on("data", c => d += c);
    res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("parse")); } });
  }).on("error", reject);
});

const htmlDecode = (s) => s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#039;/g,"'");

const genPass = (len = 16) => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_";
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

const BALL = ["It is certain.","It is decidedly so.","Without a doubt.","Yes, definitely.","You may rely on it.","As I see it, yes.","Most likely.","Outlook good.","Yes.","Signs point to yes.","Reply hazy, try again.","Ask again later.","Better not tell you now.","Cannot predict now.","Concentrate and ask again.","Don't count on it.","My reply is no.","My sources say no.","Outlook not so good.","Very doubtful."];
const ROASTS = ["You're the human version of a participation trophy.","I'd roast you but my mom said I'm not allowed to burn trash.","You're like a cloud — when you disappear it's a beautiful day.","Error 404: your intelligence not found.","You're proof that evolution can go in reverse."];
const COMPLIMENTS = ["You have an amazing sense of humor!","You light up the room when you walk in.","Your positivity is genuinely contagious.","You make the world better just by being in it.","You have the best taste in music."];
const DARES = ["Send the last photo in your camera roll.","Speak in rhymes for the next 5 minutes.","Do 20 push-ups and report back.","Change your nickname to something embarrassing for an hour.","Describe yourself using only emojis."];
const TRUTHS = ["What's the most embarrassing thing you've ever done?","What's your biggest fear?","Have you ever lied to someone you care about?","What's a secret you've never told anyone?","What's your biggest regret?"];
const WYR = ["Would you rather fly or be invisible?","Would you rather never sleep or never eat?","Would you rather lose all your memories or never make new ones?","Would you rather have unlimited money or unlimited knowledge?","Would you rather have no WiFi for a month or no music for a year?"];
const AFFIRMATIONS = ["You are enough, just as you are. 💛","You are stronger than you think. 💪","Your presence in this world matters. 🌟","You deserve all the good things coming your way. ✨","You are loved more than you know. 💕"];
const ZODIAC = { aries:{dates:"Mar 21 – Apr 19",symbol:"♈",trait:"Bold, ambitious, and passionate"},taurus:{dates:"Apr 20 – May 20",symbol:"♉",trait:"Reliable, patient, and devoted"},gemini:{dates:"May 21 – Jun 20",symbol:"♊",trait:"Curious, adaptable, and witty"},cancer:{dates:"Jun 21 – Jul 22",symbol:"♋",trait:"Intuitive, sentimental, and loyal"},leo:{dates:"Jul 23 – Aug 22",symbol:"♌",trait:"Creative, generous, and warm-hearted"},virgo:{dates:"Aug 23 – Sep 22",symbol:"♍",trait:"Analytical, practical, and hardworking"},libra:{dates:"Sep 23 – Oct 22",symbol:"♎",trait:"Diplomatic, gracious, and fair-minded"},scorpio:{dates:"Oct 23 – Nov 21",symbol:"♏",trait:"Resourceful, brave, and passionate"},sagittarius:{dates:"Nov 22 – Dec 21",symbol:"♐",trait:"Generous, idealistic, and adventurous"},capricorn:{dates:"Dec 22 – Jan 19",symbol:"♑",trait:"Responsible, disciplined, and self-controlled"},aquarius:{dates:"Jan 20 – Feb 18",symbol:"♒",trait:"Progressive, independent, and humanitarian"},pisces:{dates:"Feb 19 – Mar 20",symbol:"♓",trait:"Compassionate, artistic, and intuitive"} };

function buildModal(id, title, ...inputs) {
  const m = new ModalBuilder().setCustomId(id).setTitle(title);
  m.addComponents(inputs.map(i => new ActionRowBuilder().addComponents(i)));
  return m;
}
function input(id, label, style, opts = {}) {
  const i = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(opts.required ?? true);
  if (opts.placeholder) i.setPlaceholder(opts.placeholder);
  if (opts.value)       i.setValue(opts.value);
  if (opts.max)         i.setMaxLength(opts.max);
  if (opts.min)         i.setMinLength(opts.min ?? 0);
  return i;
}
function confirmRow(key) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("confirm:" + key).setLabel("Confirm").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("cancel:" + key).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
  );
}
function modalBtn(id, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Primary)
  );
}
async function confirm(msg, desc, fn) {
  const key = msg.author.id + ":" + Date.now();
  pendingConfirm.set(key, { fn, uid: msg.author.id });
  setTimeout(() => pendingConfirm.delete(key), 30000);
  const c = mc(0xfee75c);
  c.addTextDisplayComponents(tx("## ⚠️ Confirm\n" + desc + "\n\n-# Expires in 30 seconds."));
  return msg.channel.send({ components: [c, confirmRow(key)], flags: F, allowedMentions: { parse: [] } });
}
async function paginate(channel, uid, items, perPage, rowFn, title, color = 0x5865f2) {
  if (!items.length) return sendErr(channel, "No items to display.");
  const id    = "pg:" + uid + ":" + Date.now();
  const total = Math.ceil(items.length / perPage);
  pageStore.set(id, { items, perPage, rowFn, title, color, total });
  setTimeout(() => pageStore.delete(id), 120000);
  return renderPage(channel, id, 0);
}
async function renderPage(channel, id, page, editMsg = null) {
  const p = pageStore.get(id);
  if (!p) return;
  const slice = p.items.slice(page * p.perPage, (page + 1) * p.perPage);
  const c = mc(p.color);
  c.addTextDisplayComponents(tx("## " + p.title + "\n-# Page " + (page + 1) + " of " + p.total + "  ·  " + p.items.length + " total"));
  c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(slice.map(p.rowFn).join("\n")));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("pg:prev:" + id + ":" + page).setLabel("← Prev").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId("pg:next:" + id + ":" + page).setLabel("Next →").setStyle(ButtonStyle.Secondary).setDisabled(page >= p.total - 1)
  );
  if (editMsg) return editMsg.edit({ components: [c, row], flags: F, allowedMentions: { parse: [] } });
  return channel.send({ components: [c, row], flags: F, allowedMentions: { parse: [] } });
}

function buildNowPlaying(queue, track) {
  const loopMap = { 0: "🔄 Off", 1: "🔂 Track", 2: "🔁 Queue" };
  const loopLabel = loopMap[queue.loop] ?? "🔄 Off";
  const paused    = queue.paused;
  const c = mc(0x1db954);
  c.addTextDisplayComponents(tx(
    "## 🎵 Now Playing\n**" + track.title + "**\n" +
    (track.author ?? "") + "  ·  " + msToTime(track.length) +
    "\n-# Requested by " + (track.requester?.username ?? "Unknown") +
    "  ·  Queue: " + queue.queue.length + "  ·  Loop: " + loopLabel +
    "  ·  Vol: " + queue.volume + "%"
  ));
  c.addSeparatorComponents(sp());
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music:prev").setLabel("⏮").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:playpause").setLabel(paused ? "▶️" : "⏸").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music:skip").setLabel("⏭").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:stop").setLabel("⏹").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music:shuffle").setLabel("🔀").setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music:loop").setLabel("🔁 Loop").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:volume").setLabel("🔊 Volume").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:clearqueue").setLabel("🗑 Clear Queue").setStyle(ButtonStyle.Secondary)
  );
  return { components: [c, row1, row2], flags: F, allowedMentions: { parse: [] } };
}

function msToTime(ms) {
  if (!ms) return "0:00";
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h) return h + ":" + String(m % 60).padStart(2,"0") + ":" + String(s % 60).padStart(2,"0");
  return m + ":" + String(s % 60).padStart(2,"0");
}

kazagumo.on("playerStart", (player, track) => {
  player.data.get("channel")?.send(buildNowPlaying(player, track));
});
kazagumo.on("playerEmpty", (player) => {
  const c = mc(0x5865f2);
  c.addTextDisplayComponents(tx("## 🎵 Queue Ended\nNo more tracks in the queue."));
  player.data.get("channel")?.send({ components: [c], flags: F, allowedMentions: { parse: [] } });
});
kazagumo.on("playerClosed", (player) => {
  player.data.get("channel")?.send({ components: [(() => { const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 🔌 Player disconnected.")); return c; })()], flags: F, allowedMentions: { parse: [] } });
});
kazagumo.on("playerException", (player, track, payload) => console.error("[PLAYER EXCEPTION]", payload));
kazagumo.on("playerError", (player, track) => console.error("[PLAYER ERROR]", track));

const registry   = new Collection();
const CATEGORIES = [
  { icon: "🌐", name: "General",    list: [] },
  { icon: "🎵", name: "Music",      list: [] },
  { icon: "⚙️", name: "Tools",      list: [] },
  { icon: "🎮", name: "Fun",        list: [] },
  { icon: "🎭", name: "Actions",    list: [] },
  { icon: "💤", name: "AFK",        list: [] },
  { icon: "🔍", name: "Snipe",      list: [] },
  { icon: "⏰", name: "Reminders",  list: [] },
  { icon: "🔊", name: "Voice",      list: [] },
  { icon: "🔨", name: "Moderation", list: [] },
];

function reg(cat, name, aliases, desc, usage, run) {
  const def = { name, aliases, desc, usage, run };
  registry.set(name, def);
  for (const a of aliases) registry.set(a, def);
  CATEGORIES.find(c => c.name === cat)?.list.push(def);
}

const cmdLine = (cmd) =>
  "**" + PREFIX + cmd.name + "**" +
  (cmd.aliases.length ? " *(" + cmd.aliases.join(", ") + ")*" : "") +
  " — " + cmd.desc;


reg("General", "ping", ["latency","ms"], "Check bot latency", ".ping", async (msg) => {
  const sent = await send(msg.channel, (() => { const c = mc(); c.addTextDisplayComponents(tx("📡 Pinging...")); return c; })());
  const c = mc(); c.addTextDisplayComponents(tx("## 📡 Pong!")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Websocket:** " + client.ws.ping + "ms\n**API:** " + (sent.createdTimestamp - msg.createdTimestamp) + "ms"));
  sent.edit({ components: [c], flags: F });
});

reg("General", "botinfo", ["bot","bi","about"], "Bot stats and uptime", ".botinfo", async (msg) => {
  const u = process.uptime(), h = Math.floor(u/3600), m = Math.floor((u%3600)/60), s = Math.floor(u%60);
  const c = mc(); c.addTextDisplayComponents(tx("## 🤖 Bot Info")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Name:** " + client.user.tag + "\n**ID:** " + client.user.id + "\n**Prefix:** " + PREFIX + "\n**Uptime:** " + h + "h " + m + "m " + s + "s\n**Servers:** " + client.guilds.cache.size + "\n**discord.js:** v" + require("discord.js").version + "\n**Node.js:** " + process.version));
  send(msg.channel, c);
});

reg("General", "serverinfo", ["si","guild","server"], "Info about this server", ".serverinfo", async (msg) => {
  const g = msg.guild; if (!g) return;
  const owner = await g.fetchOwner();
  const tCh = g.channels.cache.filter(c => c.type === 0).size;
  const vCh = g.channels.cache.filter(c => c.type === 2).size;
  const c = mc(); c.addTextDisplayComponents(tx("## 🏠 " + g.name)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Owner:** " + owner.user.tag + "\n**ID:** " + g.id + "\n**Members:** " + g.memberCount + "\n**Roles:** " + g.roles.cache.size + "\n**Channels:** " + tCh + " text  ·  " + vCh + " voice\n**Boosts:** " + g.premiumSubscriptionCount + " (Level " + g.premiumTier + ")\n**Created:** <t:" + Math.floor(g.createdTimestamp/1000) + ":R>"));
  send(msg.channel, c);
});

reg("General", "userinfo", ["ui","whois","who"], "User profile info", ".userinfo [@user]", async (msg) => {
  const target = msg.mentions.users.first() ?? msg.author;
  const member = msg.guild?.members.cache.get(target.id);
  const roles  = member?.roles.cache.filter(r => r.id !== msg.guild.id).map(r => r.toString()).join(" ") || "None";
  const c = mc(); c.addTextDisplayComponents(tx("## 👤 " + target.tag)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**ID:** " + target.id + "\n**Created:** <t:" + Math.floor(target.createdTimestamp/1000) + ":R>\n" + (member ? "**Joined:** <t:" + Math.floor(member.joinedTimestamp/1000) + ":R>\n" : "") + "**Bot:** " + (target.bot ? "Yes" : "No") + "\n" + (member ? "**Roles [" + (member.roles.cache.size - 1) + "]:** " + roles : "")));
  send(msg.channel, c);
});

reg("General", "avatar", ["av","pfp","pic"], "Get a user's avatar", ".avatar [@user]", async (msg) => {
  const target = msg.mentions.users.first() ?? msg.author;
  const url    = target.displayAvatarURL({ size: 512, extension: "png" });
  const c = mc(); c.addTextDisplayComponents(tx("## 🖼️ " + target.username + "'s Avatar")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("[Open full size](" + url + ")\n" + url)); send(msg.channel, c);
});

reg("General", "banner", ["userbanner"], "Get a user's banner", ".banner [@user]", async (msg) => {
  const target = msg.mentions.users.first() ?? msg.author;
  const user   = await client.users.fetch(target.id, { force: true });
  const url    = user.bannerURL({ size: 1024 });
  const c = mc();
  if (!url) { c.addTextDisplayComponents(tx("❌  " + target.username + " has no banner.")); }
  else { c.addTextDisplayComponents(tx("## 🎨 " + target.username + "'s Banner")); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx("[Open full size](" + url + ")\n" + url)); }
  send(msg.channel, c);
});

reg("General", "membercount", ["mc","members","count"], "Member count breakdown", ".membercount", async (msg) => {
  if (!msg.guild) return;
  const bots = msg.guild.members.cache.filter(m => m.user.bot).size;
  const c = mc(); c.addTextDisplayComponents(tx("## 👥 " + msg.guild.name + "\n**Total:** " + msg.guild.memberCount + "\n**Humans:** " + (msg.guild.memberCount - bots) + "\n**Bots:** " + bots));
  send(msg.channel, c);
});

reg("General", "roleinfo", ["ri"], "Info about a role", ".roleinfo @role", async (msg) => {
  const role = msg.mentions.roles.first();
  if (!role) return sendErr(msg.channel, "Usage: " + PREFIX + "roleinfo @role");
  const c = mc(role.color || 0x5865f2); c.addTextDisplayComponents(tx("## 🎭 " + role.name)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**ID:** " + role.id + "\n**Color:** " + role.hexColor + "\n**Members:** " + role.members.size + "\n**Position:** " + role.position + "\n**Mentionable:** " + (role.mentionable ? "Yes" : "No") + "\n**Hoisted:** " + (role.hoist ? "Yes" : "No") + "\n**Created:** <t:" + Math.floor(role.createdTimestamp/1000) + ":R>"));
  send(msg.channel, c);
});

reg("General", "channelinfo", ["ci"], "Info about a channel", ".channelinfo [#channel]", async (msg) => {
  const ch = msg.mentions.channels.first() ?? msg.channel;
  const c = mc(); c.addTextDisplayComponents(tx("## 📺 #" + ch.name)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**ID:** " + ch.id + "\n**Type:** " + ch.type + "\n" + (ch.topic ? "**Topic:** " + ch.topic + "\n" : "") + (ch.rateLimitPerUser ? "**Slowmode:** " + ch.rateLimitPerUser + "s\n" : "") + "**NSFW:** " + (ch.nsfw ? "Yes" : "No") + "\n**Created:** <t:" + Math.floor(ch.createdTimestamp/1000) + ":R>"));
  send(msg.channel, c);
});

reg("General", "invite", ["inv","link"], "Generate a server invite", ".invite", async (msg) => {
  if (!msg.guild) return;
  const inv = await msg.channel.createInvite({ maxAge: 86400, maxUses: 0 });
  const c = mc(); c.addTextDisplayComponents(tx("## 🔗 Invite\nhttps://discord.gg/" + inv.code + "\n\n-# Expires in 24 hours"));
  send(msg.channel, c);
});

reg("General", "firstmsg", ["first","fm"], "Jump to the first message in a channel", ".firstmsg [#channel]", async (msg) => {
  const ch    = msg.mentions.channels.first() ?? msg.channel;
  const msgs  = await ch.messages.fetch({ limit: 1, after: "0" });
  const first = msgs.first();
  if (!first) return sendErr(msg.channel, "No messages found.");
  const c = mc(); c.addTextDisplayComponents(tx("## ⏮️ First Message in #" + ch.name + "\n**Author:** " + first.author.tag + "\n**Sent:** <t:" + Math.floor(first.createdTimestamp/1000) + ":R>\n[Jump to message](" + first.url + ")"));
  send(msg.channel, c);
});

reg("General", "inrole", ["ir"], "List members with a role", ".inrole @role", async (msg) => {
  const role = msg.mentions.roles.first();
  if (!role) return sendErr(msg.channel, "Usage: " + PREFIX + "inrole @role");
  const members = [...role.members.values()];
  if (!members.length) return sendErr(msg.channel, "No members have this role.");
  paginate(msg.channel, msg.author.id, members, 15, m => m.user.tag, "Members in " + role.name, role.color || 0x5865f2);
});

reg("General", "boosts", ["boosters"], "Show server boosters", ".boosts", async (msg) => {
  if (!msg.guild) return;
  const boosters = [...msg.guild.members.cache.filter(m => m.premiumSince).values()];
  if (!boosters.length) return sendErr(msg.channel, "No boosters.");
  paginate(msg.channel, msg.author.id, boosters, 15, m => m.user.tag + " — <t:" + Math.floor(m.premiumSinceTimestamp/1000) + ":R>", "🌸 Boosters", 0xf47fff);
});

reg("General", "emojis", ["emoji","em"], "List server emojis", ".emojis", async (msg) => {
  if (!msg.guild) return;
  const emojis = [...msg.guild.emojis.cache.values()];
  if (!emojis.length) return sendErr(msg.channel, "No emojis.");
  paginate(msg.channel, msg.author.id, emojis, 20, e => e + " " + e.name, "😄 Emojis (" + emojis.length + ")");
});

reg("General", "oldest", ["veterans","og"], "Show the oldest members", ".oldest", async (msg) => {
  if (!msg.guild) return;
  await msg.guild.members.fetch();
  const sorted = [...msg.guild.members.cache.filter(m => !m.user.bot).values()].sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
  paginate(msg.channel, msg.author.id, sorted, 10, (m, i) => (i + 1) + ".  " + m.user.tag + " — <t:" + Math.floor(m.joinedTimestamp/1000) + ":R>", "🏛️ Oldest Members");
});

reg("General", "servericon", ["gicon","sicon"], "Get the server icon", ".servericon", async (msg) => {
  if (!msg.guild) return;
  const url = msg.guild.iconURL({ size: 512, extension: "png" });
  if (!url) return sendErr(msg.channel, "This server has no icon.");
  const c = mc(); c.addTextDisplayComponents(tx("## 🖼️ " + msg.guild.name + " Icon")); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx("[Open full size](" + url + ")\n" + url));
  send(msg.channel, c);
});

reg("General", "serverbanner", ["sbanner"], "Get the server banner", ".serverbanner", async (msg) => {
  if (!msg.guild) return;
  const url = msg.guild.bannerURL({ size: 1024 });
  if (!url) return sendErr(msg.channel, "This server has no banner.");
  const c = mc(); c.addTextDisplayComponents(tx("## 🎨 " + msg.guild.name + " Banner")); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx("[Open full size](" + url + ")\n" + url));
  send(msg.channel, c);
});

reg("General", "permissions", ["perms","perm"], "List a user's permissions in this channel", ".permissions [@user]", async (msg) => {
  const target  = msg.mentions.members.first() ?? msg.member;
  const perms   = msg.channel.permissionsFor(target);
  if (!perms) return sendErr(msg.channel, "Could not fetch permissions.");
  const allowed = Object.entries(PermissionFlagsBits).filter(([, bit]) => perms.has(bit)).map(([n]) => n.replace(/([A-Z])/g, " $1").trim()).slice(0, 20);
  const c = mc(); c.addTextDisplayComponents(tx("## 🔐 Permissions — " + target.user.username)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(allowed.join("\n") || "No permissions.")); send(msg.channel, c);
});

reg("General", "joinpos", ["jp","joinrank"], "Show member join position", ".joinpos [@user]", async (msg) => {
  if (!msg.guild) return;
  await msg.guild.members.fetch();
  const target = msg.mentions.members.first() ?? msg.member;
  const sorted = [...msg.guild.members.cache.values()].sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
  const pos    = sorted.findIndex(m => m.id === target.id) + 1;
  const c = mc(); c.addTextDisplayComponents(tx("## 📊 Join Position\n**" + target.user.tag + "** joined as member **#" + pos + "** out of " + msg.guild.memberCount + "."));
  send(msg.channel, c);
});

reg("General", "presence", ["activity","doing"], "See what a user is doing", ".presence [@user]", async (msg) => {
  const target = msg.mentions.members.first() ?? msg.member;
  const pres   = target.presence;
  if (!pres || !pres.activities.length) return sendErr(msg.channel, "**" + target.user.username + "** has no visible activity.");
  const typeMap = { 0: "Playing", 1: "Streaming", 2: "Listening to", 3: "Watching", 4: "Custom", 5: "Competing in" };
  const lines   = pres.activities.map(a => (typeMap[a.type] ?? "Doing") + " **" + a.name + "**" + (a.details ? "\n  ↳ " + a.details : "") + (a.state ? "\n  ↳ " + a.state : "")).join("\n");
  const c = mc(); c.addTextDisplayComponents(tx("## 🟢 " + target.user.username + "'s Activity")); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx(lines));
  send(msg.channel, c);
});

reg("General", "created", ["age","accountage"], "Show when an account was created", ".created [@user]", async (msg) => {
  const target = msg.mentions.users.first() ?? msg.author;
  const ts     = Math.floor(target.createdTimestamp/1000);
  const c = mc(); c.addTextDisplayComponents(tx("## 📅 Account Age — " + target.username + "\n**Created:** <t:" + ts + ":F>\n**Age:** " + fmtDur(Date.now() - target.createdTimestamp) + " ago"));
  send(msg.channel, c);
});

reg("General", "lookup", ["fetchuser","getuser"], "Fetch any user by ID", ".lookup <userID>", async (msg, args) => {
  if (!args[0]) return sendErr(msg.channel, "Usage: " + PREFIX + "lookup <userID>");
  let user; try { user = await client.users.fetch(args[0], { force: true }); } catch { return sendErr(msg.channel, "User not found."); }
  const c = mc(); c.addTextDisplayComponents(tx("## 👤 " + user.tag)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**ID:** " + user.id + "\n**Created:** <t:" + Math.floor(user.createdTimestamp/1000) + ":R>\n**Bot:** " + (user.bot ? "Yes" : "No")));
  send(msg.channel, c);
});

reg("General", "id", ["getid","snowflake"], "Get the ID of a user, role, or channel", ".id [@user|@role|#channel]", async (msg) => {
  const target = msg.mentions.users.first() ?? msg.mentions.roles.first() ?? msg.mentions.channels.first();
  const c = mc(); c.addTextDisplayComponents(tx("## 🔢 ID\n**" + (target?.tag ?? target?.name ?? msg.author.tag) + "**\n" + (target?.id ?? msg.author.id)));
  send(msg.channel, c);
});

reg("General", "uptime", ["ut","up"], "Show bot uptime", ".uptime", async (msg) => {
  const c = mc(); c.addTextDisplayComponents(tx("## ⏱️ Uptime\n" + fmtDur(process.uptime() * 1000)));
  send(msg.channel, c);
});

reg("General", "snowflake", ["sf","parseid"], "Parse a Discord snowflake ID", ".snowflake <id>", async (msg, args) => {
  if (!args[0] || isNaN(args[0])) return sendErr(msg.channel, "Usage: " + PREFIX + "snowflake <id>");
  const ts = Math.floor(Number(BigInt(args[0]) >> 22n) + 1420070400000);
  const c  = mc(); c.addTextDisplayComponents(tx("## ❄️ Snowflake — " + args[0])); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Created:** <t:" + Math.floor(ts/1000) + ":F>\n**Timestamp:** " + ts + "ms"));
  send(msg.channel, c);
});

reg("General", "serverroles", ["sr","listroles","roles"], "List all server roles", ".serverroles", async (msg) => {
  if (!msg.guild) return;
  const roles = [...msg.guild.roles.cache.filter(r => r.id !== msg.guild.id).values()].sort((a, b) => b.position - a.position);
  paginate(msg.channel, msg.author.id, roles, 15, r => "**" + r.name + "** — " + r.members.size + " members", "🎭 Roles (" + roles.length + ")");
});

reg("General", "newmembers", ["new","newest"], "Show the newest members", ".newmembers", async (msg) => {
  if (!msg.guild) return;
  await msg.guild.members.fetch();
  const sorted = [...msg.guild.members.cache.filter(m => !m.user.bot).values()].sort((a, b) => b.joinedTimestamp - a.joinedTimestamp);
  paginate(msg.channel, msg.author.id, sorted, 10, (m, i) => (i + 1) + ".  " + m.user.tag + " — <t:" + Math.floor(m.joinedTimestamp/1000) + ":R>", "🆕 Newest Members");
});

reg("General", "commandstats", ["cs","cmdstats"], "Show command and alias count", ".commandstats", async (msg) => {
  const total   = CATEGORIES.reduce((t, cat) => t + cat.list.length, 0);
  const aliases = registry.size - total;
  const c = mc(); c.addTextDisplayComponents(tx("## 📊 Command Stats")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Total Commands:** " + total + "\n**Total Aliases:** " + aliases + "\n\n" + CATEGORIES.filter(cat => cat.list.length).map(cat => cat.icon + " **" + cat.name + ":** " + cat.list.length).join("\n")));
  send(msg.channel, c);
});

reg("General", "whitelist", ["w","wa","wr","wl"], "Manage the bot whitelist (owner only)", ".whitelist add/remove/list", async (msg, args, invoked) => {
  if (msg.author.id !== OWNER) return;
  const map = { wa: "add", wr: "remove", wl: "list" };
  if (map[invoked]) args.unshift(map[invoked]);
  const sub    = args[0]?.toLowerCase();
  const target = msg.mentions.users.first() ?? (args[1] ? { id: args[1], tag: args[1] } : null);
  if (sub === "add") {
    if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "whitelist add @user or ID");
    whitelist.add(target.id);
    sendOk(msg.channel, "## ✅ Whitelisted\n**" + (target.tag ?? target.id) + "** can now use the bot.");
  } else if (sub === "remove") {
    if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "whitelist remove @user or ID");
    if (target.id === OWNER) return sendErr(msg.channel, "You cannot remove yourself.");
    whitelist.delete(target.id);
    sendOk(msg.channel, "## ✅ Removed\n**" + (target.tag ?? target.id) + "** can no longer use the bot.");
  } else if (sub === "list") {
    const c = mc(); c.addTextDisplayComponents(tx("## 📋 Whitelist\n" + [...whitelist].map((id, i) => (i + 1) + ".  <@" + id + "> (" + id + ")").join("\n")));
    send(msg.channel, c);
  } else { sendErr(msg.channel, "Usage: " + PREFIX + "whitelist add / remove / list"); }
});

reg("General", "help", ["h","commands","cmds"], "List commands or get details on one", ".help [command]", async (msg, args) => {
  if (args[0]) {
    const found = registry.get(args[0].toLowerCase());
    if (found) {
      const cat = CATEGORIES.find(c => c.list.includes(found));
      const c   = mc(0x5865f2); c.addTextDisplayComponents(tx("## " + PREFIX + found.name + "\n-# " + (cat ? cat.icon + "  " + cat.name : "General"))); c.addSeparatorComponents(sp());
      c.addTextDisplayComponents(tx("**Description**\n" + found.desc + "\n\n**Usage**\n" + found.usage + (found.aliases.length ? "\n\n**Aliases**\n" + found.aliases.map(a => PREFIX + a).join("  ·  ") : "")));
      return send(msg.channel, c);
    }
    const matchedCat = CATEGORIES.find(cat => cat.name.toLowerCase() === args[0].toLowerCase());
    if (matchedCat) return sendHelpCat(msg.channel, matchedCat);
    return sendErr(msg.channel, "Unknown command: " + args[0]);
  }
  const total = CATEGORIES.reduce((t, cat) => t + cat.list.length, 0);
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 📋 Command List\n-# Prefix: " + PREFIX + "  ·  " + total + " commands  ·  " + PREFIX + "help <command> for details")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(CATEGORIES.filter(cat => cat.list.length).map(cat => cat.icon + "  **" + cat.name + "** — " + cat.list.length + " commands").join("\n")));
  const select = new StringSelectMenuBuilder().setCustomId("help:cat").setPlaceholder("Browse a category...")
    .addOptions(CATEGORIES.filter(cat => cat.list.length).map(cat => new StringSelectMenuOptionBuilder().setLabel(cat.name).setValue(cat.name).setDescription(cat.list.length + " commands").setEmoji(cat.icon)));
  msg.channel.send({ components: [c, new ActionRowBuilder().addComponents(select)], flags: F, allowedMentions: { parse: [] } });
});

function sendHelpCat(channel, cat) {
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx(cat.icon + "  **" + cat.name + "** — " + cat.list.length + " commands")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(cat.list.map(cmd => cmdLine(cmd)).join("\n"))); return send(channel, c);
}


reg("Music", "play", ["p","add"], "Play a song or add it to the queue", ".play <song or URL>", async (msg, args) => {
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "play <song or URL>");
  const query = args.join(" ");
  const c = mc(0x1db954); c.addTextDisplayComponents(tx("🔍 Searching for **" + query + "**..."));
  const sent = await send(msg.channel, c);
  try {
    let player2 = kazagumo.players.get(msg.guild.id);
    if (!player2) {
      player2 = await kazagumo.createPlayer({
        guildId: msg.guild.id,
        textId:  msg.channel.id,
        voiceId: msg.member.voice.channel.id,
        volume:  80,
        deaf:    true,
      });
      player2.data.set("channel", msg.channel);
    }
    const res = await kazagumo.search(query, { requester: msg.author });
    if (!res || !res.tracks.length) {
      const upd = mc(0xed4245); upd.addTextDisplayComponents(tx("❌  No results found for **" + query + "**.")); return sent.edit({ components: [upd], flags: F });
    }
    if (res.type === "PLAYLIST") {
      for (const track of res.tracks) player2.queue.add(track);
      const upd = mc(0x1db954); upd.addTextDisplayComponents(tx("## ✅ Playlist Added\n**" + res.playlistName + "** — " + res.tracks.length + " tracks\n-# Requested by " + msg.author.username));
      sent.edit({ components: [upd], flags: F });
    } else {
      player2.queue.add(res.tracks[0]);
      const upd = mc(0x1db954); upd.addTextDisplayComponents(tx("## ✅ Added to Queue\n**" + res.tracks[0].title + "**\n" + (res.tracks[0].author ?? "") + "  ·  " + msToTime(res.tracks[0].length) + "\n-# Requested by " + msg.author.username));
      sent.edit({ components: [upd], flags: F });
    }
    if (!player2.playing && !player2.paused) player2.play();
  } catch (e) {
    console.error("[PLAY]", e);
    const upd = mc(0xed4245); upd.addTextDisplayComponents(tx("❌  Could not play that. Try a different search or URL.")); sent.edit({ components: [upd], flags: F });
  }
});

reg("Music", "skip", ["s","next"], "Skip the current track", ".skip", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  const title = queue.current.title;
  queue.skip();
  sendOk(msg.channel, "## ⏭️ Skipped\n**" + title + "**");
});

reg("Music", "stop", ["leave","dc"], "Stop music and leave the voice channel", ".stop", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  queue.destroy();
  sendOk(msg.channel, "## ⏹️ Stopped\nQueue cleared and left the voice channel.");
});

reg("Music", "pause", ["paus"], "Pause the current track", ".pause", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  if (queue.paused) return sendErr(msg.channel, "Already paused. Use " + PREFIX + "resume.");
  queue.pause(true);
  sendOk(msg.channel, "## ⏸️ Paused");
});

reg("Music", "resume", ["res","unpause"], "Resume the paused track", ".resume", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  if (!queue.paused) return sendErr(msg.channel, "Not paused. Use " + PREFIX + "pause.");
  queue.pause(false);
  sendOk(msg.channel, "## ▶️ Resumed");
});

reg("Music", "nowplaying", ["np","current","playing"], "Show the currently playing track", ".nowplaying", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  const track    = queue.current;
  const loopMap  = { 0: "🔄 Off", 1: "🔂 Track", 2: "🔁 Queue" };
  const pos      = queue.position;
  const total    = track.length;
  const filled   = Math.round((pos / total) * 15);
  const bar      = "▬".repeat(filled) + "🔘" + "▬".repeat(15 - filled);
  const c = mc(0x1db954); c.addTextDisplayComponents(tx("## 🎵 Now Playing\n**" + track.title + "**\n" + (track.author ?? "") + "  ·  " + msToTime(total))); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(bar + "  " + msToTime(pos) + " / " + msToTime(total) + "\n\n**Volume:** " + queue.volume + "%  ·  **Loop:** " + (loopMap[queue.loop] ?? "Off") + "\n-# Requested by " + (track.requester?.username ?? "Unknown")));
  send(msg.channel, c);
});

reg("Music", "queue", ["q2","list","tracklist"], "Show the current queue", ".queue [page]", async (msg, args) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  const tracks  = queue.queue;
  const current = queue.current;
  const c = mc(0x1db954); c.addTextDisplayComponents(tx("## 🎶 Queue  ·  " + (tracks.length + 1) + " track(s)")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Now Playing:** " + current.title + "  ·  " + msToTime(current.length)));
  if (tracks.length) {
    const page  = Math.max(1, parseInt(args[0]) || 1) - 1;
    const slice = tracks.slice(page * 10, (page + 1) * 10);
    c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx(slice.map((t, i) => "**" + (page * 10 + i + 1) + ".** " + t.title + "  ·  " + msToTime(t.length)).join("\n")));
  }
  send(msg.channel, c);
});

reg("Music", "volume", ["vol","v2"], "Set the playback volume (1–100)", ".volume <1-100>", async (msg, args) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  const vol = parseInt(args[0]);
  if (isNaN(vol) || vol < 1 || vol > 100) return sendErr(msg.channel, "Usage: " + PREFIX + "volume <1-100>");
  queue.setVolume(vol);
  sendOk(msg.channel, "## 🔊 Volume\nSet to **" + vol + "%**");
});

reg("Music", "shuffle", ["mix","shuf"], "Shuffle the queue", ".shuffle", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  if (queue.queue.length < 2) return sendErr(msg.channel, "Not enough tracks to shuffle.");
  queue.queue.shuffle();
  sendOk(msg.channel, "## 🔀 Shuffled\nQueue has been shuffled!");
});

reg("Music", "loop", ["repeat","lp"], "Set loop mode (off/track/queue)", ".loop <off|track|queue>", async (msg, args) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  const modes = { off: "none", track: "track", queue: "queue" };
  const mode  = args[0]?.toLowerCase();
  if (!mode || !(mode in modes)) return sendErr(msg.channel, "Usage: " + PREFIX + "loop off / track / queue");
  queue.setLoop(modes[mode]);
  sendOk(msg.channel, "## 🔁 Loop\nMode set to **" + mode + "**");
});

reg("Music", "remove", ["rem","rmtrack"], "Remove a track from the queue by position", ".remove <position>", async (msg, args) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  const pos = parseInt(args[0]) - 1;
  if (isNaN(pos) || pos < 0 || pos >= queue.queue.length) return sendErr(msg.channel, "Invalid position. See " + PREFIX + "queue.");
  const track = queue.queue[pos];
  queue.queue.splice(pos, 1);
  sendOk(msg.channel, "## 🗑️ Removed\n**" + track.title + "** removed from the queue.");
});

reg("Music", "clearqueue", ["cq","clearq"], "Clear all tracks from the queue", ".clearqueue", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  queue.queue.splice(0, queue.queue.length);
  sendOk(msg.channel, "## 🗑️ Queue Cleared\nAll upcoming tracks removed.");
});

reg("Music", "seek", ["sk","seekto"], "Seek to a position in the track", ".seek <time>  e.g. 1:30", async (msg, args) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  if (!args[0]) return sendErr(msg.channel, "Usage: " + PREFIX + "seek 1:30");
  const parts = args[0].split(":").map(Number).reverse();
  const ms    = ((parts[2] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[0] || 0)) * 1000;
  if (!ms) return sendErr(msg.channel, "Invalid time format. Use 1:30 or 0:45");
  await queue.seek(ms);
  sendOk(msg.channel, "## ⏩ Seeked\nJumped to **" + args[0] + "**");
});

reg("Music", "skipto", ["st","jump"], "Skip to a specific track in the queue", ".skipto <position>", async (msg, args) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  const pos = parseInt(args[0]) - 1;
  if (isNaN(pos) || pos < 0 || pos >= queue.queue.length) return sendErr(msg.channel, "Invalid position. See " + PREFIX + "queue.");
  queue.queue.splice(0, pos);
  queue.skip();
  sendOk(msg.channel, "## ⏭️ Jumped to track **" + (pos + 1) + "**");
});

reg("Music", "previous", ["prev","back"], "Play the previous track", ".previous", async (msg) => {
  const queue = kazagumo.players.get(msg.guild.id);
  if (!queue?.current) return sendErr(msg.channel, "Nothing is playing right now.");
  if (!msg.member.voice.channel) return sendErr(msg.channel, "You need to be in a voice channel.");
  sendErr(msg.channel, "Previous track is not supported with Lavalink in this setup.");
});

reg("Music", "lyrics", ["ly","lyric","song"], "Get song lyrics", ".lyrics <artist> - <title>", async (msg, args) => {
  const raw   = args.join(" ");
  const split = raw.split("-").map(s => s.trim());
  if (split.length < 2 || !split[0] || !split[1]) return sendErr(msg.channel, "Usage: " + PREFIX + "lyrics Laufey - From The Start");
  const artist = split[0], title = split.slice(1).join("-").trim();
  const loading = await send(msg.channel, (() => { const c = mc(); c.addTextDisplayComponents(tx("🎵 Fetching lyrics for **" + title + "** by **" + artist + "**...")); return c; })());
  let data; try { data = await fetchJSON("https://api.lyrics.ovh/v1/" + encodeURIComponent(artist) + "/" + encodeURIComponent(title)); } catch { loading.delete().catch(() => {}); return sendErr(msg.channel, "Could not reach the lyrics API."); }
  loading.delete().catch(() => {});
  if (data.error || !data.lyrics) return sendErr(msg.channel, "No lyrics found for **" + title + "** by **" + artist + "**.");
  const raw2 = data.lyrics.replace(/\r\n/g, "\n").trim(), MAX = 3800;
  if (raw2.length <= MAX) {
    const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 🎵 " + title + "\n-# " + artist)); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx(raw2)); return send(msg.channel, c);
  }
  const chunks = []; let remaining = raw2;
  while (remaining.length > 0) {
    let slice = remaining.slice(0, MAX); const nl = slice.lastIndexOf("\n"); if (nl > MAX * 0.6) slice = remaining.slice(0, nl);
    chunks.push(slice.trim()); remaining = remaining.slice(slice.length).trimStart();
  }
  for (let i = 0; i < chunks.length; i++) {
    const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 🎵 " + title + (chunks.length > 1 ? "  —  Part " + (i + 1) + " of " + chunks.length : "") + "\n-# " + artist)); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx(chunks[i])); await send(msg.channel, c);
  }
});

reg("Music", "spotify", ["sp","npspot"], "See what someone is listening to on Spotify", ".spotify [@user]", async (msg) => {
  const target = msg.mentions.members.first() ?? msg.member;
  const act    = target.presence?.activities.find(a => a.name === "Spotify" && a.type === ActivityType.Listening);
  if (!act) return sendErr(msg.channel, "**" + target.user.username + "** is not listening to Spotify right now.");
  const c = mc(0x1db954); c.addTextDisplayComponents(tx("## 🎧 Spotify — " + target.user.username)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Track:** " + (act.details ?? "Unknown") + "\n**Artist:** " + (act.state ?? "Unknown") + "\n**Album:** " + (act.assets?.largeText ?? "Unknown")));
  send(msg.channel, c);
});


reg("Tools", "say", ["echo","repeat"], "Bot sends a message via modal", ".say", async (msg) => {
  const key = "say:" + msg.author.id + ":" + msg.channel.id;
  const c = mc(); c.addTextDisplayComponents(tx("## 💬 Say\nClick below to compose your message."));
  msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Write Message")], flags: F, allowedMentions: { parse: [] } });
});

reg("Tools", "announce", ["ann","announcement"], "Post an announcement to a channel", ".announce #channel", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageMessages)) return sendErr(msg.channel, "Missing ManageMessages permission.");
  const target = msg.mentions.channels.first();
  if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "announce #channel");
  const key = "announce:" + msg.author.id + ":" + target.id;
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 📢 Announce\nClick below to write your announcement for " + target + "."));
  msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Write Announcement")], flags: F, allowedMentions: { parse: [] } });
});

reg("Tools", "poll", ["vote"], "Create a yes/no poll via modal", ".poll", async (msg) => {
  const key = "poll:" + msg.author.id + ":" + msg.channel.id;
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 📊 Create Poll\nClick below to write your poll question."));
  msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Write Question")], flags: F, allowedMentions: { parse: [] } });
});

reg("Tools", "poll2", ["mpoll","multipoll"], "Create a multi-choice poll", ".poll2 <question> | <opt1> | <opt2>...", async (msg, args) => {
  const parts = args.join(" ").split("|").map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) return sendErr(msg.channel, "Usage: " + PREFIX + "poll2 Best food? | Pizza | Sushi | Tacos");
  const [question, ...options] = parts;
  if (options.length > 9) return sendErr(msg.channel, "Max 9 options.");
  const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 📊 Poll\n" + question + "\n\n" + options.map((o, i) => nums[i] + "  " + o).join("\n") + "\n\n-# Asked by " + msg.author.username));
  const m = await send(msg.channel, c);
  for (let i = 0; i < options.length; i++) await m.react(nums[i]).catch(() => {});
});

reg("Tools", "stealemoji", ["steal","addemoji","se"], "Copy an emoji to this server", ".stealemoji <emoji> [name]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageEmojisAndStickers)) return sendErr(msg.channel, "Missing ManageEmojisAndStickers permission.");
  const match = args[0]?.match(/^<a?:(\w+):(\d+)>$/);
  if (!match) return sendErr(msg.channel, "Usage: " + PREFIX + "stealemoji <emoji> [name]");
  const [, ename, eid] = match;
  const url   = "https://cdn.discordapp.com/emojis/" + eid + "." + (args[0].startsWith("<a:") ? "gif" : "png");
  const emoji = await msg.guild.emojis.create({ attachment: url, name: args[1] ?? ename });
  sendOk(msg.channel, "## ✅ Emoji Added\n" + emoji + "  " + emoji.name);
});

reg("Tools", "topic", ["settopic"], "Set or clear a channel topic", ".topic <text> | .topic clear", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  if (!args.length) {
    const key = "topic:" + msg.author.id + ":" + msg.channel.id;
    const c = mc(); c.addTextDisplayComponents(tx("## 📝 Set Topic\nClick below to set the topic."));
    return msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Set Topic")], flags: F, allowedMentions: { parse: [] } });
  }
  const text = args.join(" ");
  await msg.channel.setTopic(text.toLowerCase() === "clear" ? null : text);
  sendOk(msg.channel, text.toLowerCase() === "clear" ? "## ✅ Topic Cleared" : "## ✅ Topic Set\n" + text);
});

reg("Tools", "note", ["notes"], "Personal notes", ".note add | .note list | .note clear", async (msg, args) => {
  const sub = args[0]?.toLowerCase(), uid = msg.author.id;
  if (sub === "add") {
    const key = "note:" + uid;
    const c = mc(); c.addTextDisplayComponents(tx("## 📝 Add Note\nClick below to write your note."));
    return msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Write Note")], flags: F, allowedMentions: { parse: [] } });
  } else if (sub === "list") {
    const list = notes.get(uid) ?? [];
    if (!list.length) return sendErr(msg.channel, "You have no notes.");
    paginate(msg.channel, uid, list, 10, (n, i) => "**" + (i + 1) + ".** " + n.text + "\n  -# <t:" + Math.floor(n.at/1000) + ":R>", "📝 Your Notes");
  } else if (sub === "clear") { notes.delete(uid); sendOk(msg.channel, "## ✅ Notes Cleared");
  } else { sendErr(msg.channel, "Usage: " + PREFIX + "note add / list / clear"); }
});

reg("Tools", "tag", ["tags","snippet"], "Server text snippets", ".tag set <n> | .tag get <n> | .tag list | .tag delete <n>", async (msg, args) => {
  const sub = args[0]?.toLowerCase(), name = args[1]?.toLowerCase();
  if (sub === "set") {
    if (!name) return sendErr(msg.channel, "Usage: " + PREFIX + "tag set <n>");
    const key = "tag:" + msg.author.id + ":" + name;
    const c = mc(); c.addTextDisplayComponents(tx("## 🏷️ Set Tag: " + name + "\nClick below to write the content."));
    return msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Write Tag Content")], flags: F, allowedMentions: { parse: [] } });
  } else if (sub === "get") {
    const tag = tags.get(name); if (!tag) return sendErr(msg.channel, "Tag " + name + " not found.");
    const c = mc(); c.addTextDisplayComponents(tx(tag.text)); send(msg.channel, c);
  } else if (sub === "list") {
    if (!tags.size) return sendErr(msg.channel, "No tags saved.");
    paginate(msg.channel, msg.author.id, [...tags.keys()], 20, k => "**" + k + "** — by " + (tags.get(k)?.author ?? "?"), "🏷️ Tags");
  } else if (sub === "delete") {
    if (!tags.has(name)) return sendErr(msg.channel, "Tag " + name + " not found.");
    tags.delete(name); sendOk(msg.channel, "## ✅ Tag Deleted\n**" + name + "** removed.");
  } else { sendErr(msg.channel, "Usage: " + PREFIX + "tag set / get / list / delete"); }
});

reg("Tools", "hex", ["colorhex","hx"], "Hex color info and RGB breakdown", ".hex <#hexcode>", async (msg, args) => {
  const hex = args[0]?.replace("#", "");
  if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) return sendErr(msg.channel, "Usage: " + PREFIX + "hex #ff5733");
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  const c = mc(parseInt(hex,16)); c.addTextDisplayComponents(tx("## 🎨 #" + hex.toUpperCase())); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**HEX:** #" + hex.toUpperCase() + "\n**RGB:** " + r + ", " + g + ", " + b + "\n**Decimal:** " + parseInt(hex,16)));
  send(msg.channel, c);
});

reg("Tools", "charcount", ["cc","wc"], "Count characters, words and lines", ".charcount <text>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "charcount <text>");
  const text = args.join(" "), words = text.trim().split(/\s+/).length;
  const c = mc(); c.addTextDisplayComponents(tx("## 🔡 Character Count")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Characters:** " + text.length + "\n**Without spaces:** " + text.replace(/\s/g,"").length + "\n**Words:** " + words + "\n**Lines:** " + text.split("\n").length));
  send(msg.channel, c);
});

reg("Tools", "password", ["pass","pw","genpass"], "Generate a secure password", ".password [length]", async (msg, args) => {
  const len = Math.min(Math.max(parseInt(args[0]) || 16, 8), 64);
  const c = mc(0x57f287); c.addTextDisplayComponents(tx("## 🔑 Password Generated\n" + genPass(len) + "\n\n-# Length: " + len + "  ·  Keep this private!"));
  send(msg.channel, c);
});

reg("Tools", "weather", ["wthr","forecast"], "Get weather for a city", ".weather <city>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "weather London");
  let data; try { data = await fetchJSON("https://wttr.in/" + encodeURIComponent(args.join(" ")) + "?format=j1"); } catch { return sendErr(msg.channel, "Could not fetch weather."); }
  const cur = data.current_condition?.[0], area = data.nearest_area?.[0];
  if (!cur) return sendErr(msg.channel, "No weather data found.");
  const location = (area?.areaName?.[0]?.value ?? args.join(" ")) + ", " + (area?.country?.[0]?.value ?? "");
  const c = mc(0x5488c8); c.addTextDisplayComponents(tx("## ☁️ Weather — " + location)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Condition:** " + cur.weatherDesc?.[0]?.value + "\n**Temperature:** " + cur.temp_C + "°C  /  " + cur.temp_F + "°F\n**Feels Like:** " + cur.FeelsLikeC + "°C\n**Humidity:** " + cur.humidity + "%\n**Wind:** " + cur.windspeedKmph + " km/h"));
  send(msg.channel, c);
});

reg("Tools", "define", ["def","dictionary","dict"], "Look up a word definition", ".define <word>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "define serendipity");
  let data; try { data = await fetchJSON("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(args[0].toLowerCase())); } catch { return sendErr(msg.channel, "Could not reach dictionary API."); }
  if (!Array.isArray(data) || !data[0]) return sendErr(msg.channel, "No definition found for **" + args[0] + "**.");
  const entry = data[0], meaning = entry.meanings?.[0], def = meaning?.definitions?.[0];
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 📖 " + entry.word + (entry.phonetic ? "  " + entry.phonetic : ""))); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Part of speech:** " + (meaning?.partOfSpeech ?? "Unknown") + "\n\n" + (def?.definition ?? "No definition.") + (def?.example ? "\n\n**Example:** " + def.example : "")));
  send(msg.channel, c);
});

reg("Tools", "urban", ["ud","urb","slang"], "Look up a term on Urban Dictionary", ".urban <term>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "urban yeet");
  let data; try { data = await fetchJSON("https://api.urbandictionary.com/v0/define?term=" + encodeURIComponent(args.join(" "))); } catch { return sendErr(msg.channel, "Could not reach Urban Dictionary."); }
  const result = data.list?.[0]; if (!result) return sendErr(msg.channel, "No Urban Dictionary entry found.");
  const c = mc(0x1d3461); c.addTextDisplayComponents(tx("## 📚 " + result.word)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(result.definition.replace(/\[|\]/g,"").slice(0,600) + (result.example ? "\n\n**Example:** " + result.example.replace(/\[|\]/g,"").slice(0,300) : "") + "\n\n👍 " + result.thumbs_up + "  ·  👎 " + result.thumbs_down));
  send(msg.channel, c);
});

reg("Tools", "qr", ["qrcode","qrgen"], "Generate a QR code", ".qr <text>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "qr <url or text>");
  const text = args.join(" "), url = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(text);
  const c = mc(); c.addTextDisplayComponents(tx("## 📷 QR Code\n**Data:** " + text + "\n\n[Open QR Code](" + url + ")\n" + url));
  send(msg.channel, c);
});

reg("Tools", "currency", ["convert","fx","exchange"], "Convert currency", ".currency <amount> <from> <to>", async (msg, args) => {
  const amount = parseFloat(args[0]), from = args[1]?.toUpperCase(), to = args[2]?.toUpperCase();
  if (isNaN(amount) || !from || !to) return sendErr(msg.channel, "Usage: " + PREFIX + "currency 100 USD EUR");
  let data; try { data = await fetchJSON("https://open.er-api.com/v6/latest/" + from); } catch { return sendErr(msg.channel, "Could not fetch exchange rates."); }
  if (data.result !== "success") return sendErr(msg.channel, "Invalid currency: " + from);
  const rate = data.rates[to]; if (!rate) return sendErr(msg.channel, "Unknown target currency: " + to);
  const c = mc(0x57f287); c.addTextDisplayComponents(tx("## 💱 Currency\n**" + amount + " " + from + "** = **" + (amount * rate).toFixed(2) + " " + to + "**\n-# Rate: 1 " + from + " = " + rate + " " + to));
  send(msg.channel, c);
});

reg("Tools", "advice", ["tip","getadvice"], "Get a random piece of advice", ".advice", async (msg) => {
  let data; try { data = await fetchJSON("https://api.adviceslip.com/advice"); } catch { return sendErr(msg.channel, "Could not fetch advice."); }
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 💡 Advice\n" + (data.slip?.advice ?? "No advice found.")));
  send(msg.channel, c);
});

reg("Tools", "countdown", ["until","daysuntil"], "Days until a date", ".countdown YYYY-MM-DD", async (msg, args) => {
  const target = new Date((args[0] ?? "") + "T00:00:00");
  if (!args[0] || isNaN(target)) return sendErr(msg.channel, "Usage: " + PREFIX + "countdown 2026-12-31");
  const diff = target - Date.now(); if (diff <= 0) return sendErr(msg.channel, "That date has already passed.");
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## ⏳ Countdown to " + args[0] + "\n**" + Math.ceil(diff/86400000) + " days** remaining\n<t:" + Math.floor(target/1000) + ":D>"));
  send(msg.channel, c);
});

reg("Tools", "tempconvert", ["tc","temperature"], "Convert between °C / °F / K", ".tempconvert 100c", async (msg, args) => {
  const raw = args[0]?.toLowerCase(), val = parseFloat(raw), unit = raw?.replace(/[\d.-]/g,"");
  if (isNaN(val) || !unit) return sendErr(msg.channel, "Usage: " + PREFIX + "tempconvert 100c  (c/f/k)");
  let cv, fv, kv;
  if (unit==="c") { cv=val; fv=val*9/5+32; kv=val+273.15; }
  else if (unit==="f") { cv=(val-32)*5/9; fv=val; kv=(val-32)*5/9+273.15; }
  else if (unit==="k") { cv=val-273.15; fv=(val-273.15)*9/5+32; kv=val; }
  else return sendErr(msg.channel, "Unknown unit. Use c, f, or k.");
  const c = mc(); c.addTextDisplayComponents(tx("## 🌡️ Temperature\n**Celsius:** " + cv.toFixed(2) + "°C\n**Fahrenheit:** " + fv.toFixed(2) + "°F\n**Kelvin:** " + kv.toFixed(2) + " K"));
  send(msg.channel, c);
});

reg("Tools", "addrole", ["ar","giverole","gr"], "Give a role to a member", ".addrole @user @role", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageRoles)) return sendErr(msg.channel, "Missing ManageRoles permission.");
  const target = msg.mentions.members.first(), role = msg.mentions.roles.first();
  if (!target || !role) return sendErr(msg.channel, "Usage: " + PREFIX + "addrole @user @role");
  if (role.position >= msg.guild.members.me.roles.highest.position) return sendErr(msg.channel, "That role is higher than my highest role.");
  await target.roles.add(role);
  sendOk(msg.channel, "## ✅ Role Added\nGave " + role + " to **" + target.user.tag + "**.");
});

reg("Tools", "removerole", ["rr","takerole","delrole"], "Take a role from a member", ".removerole @user @role", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageRoles)) return sendErr(msg.channel, "Missing ManageRoles permission.");
  const target = msg.mentions.members.first(), role = msg.mentions.roles.first();
  if (!target || !role) return sendErr(msg.channel, "Usage: " + PREFIX + "removerole @user @role");
  await target.roles.remove(role);
  sendOk(msg.channel, "## ✅ Role Removed\nRemoved " + role + " from **" + target.user.tag + "**.");
});

reg("Tools", "massrole", ["mr","roleall"], "Add a role to every member", ".massrole @role", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.Administrator)) return sendErr(msg.channel, "You need Administrator permission for this.");
  const role = msg.mentions.roles.first(); if (!role) return sendErr(msg.channel, "Usage: " + PREFIX + "massrole @role");
  await msg.guild.members.fetch();
  const members = msg.guild.members.cache.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
  confirm(msg, "Add " + role + " to **" + members.size + "** members?\nThis may take a while.", async () => {
    const m = await sendOk(msg.channel, "## ⏳ Adding role..."); let done = 0;
    for (const [, member] of members) { await member.roles.add(role).catch(() => {}); done++; }
    const c = mc(0x57f287); c.addTextDisplayComponents(tx("## ✅ Mass Role Done\nAdded " + role + " to **" + done + "** members.")); m.edit({ components: [c], flags: F });
  });
});

reg("Tools", "createrole", ["newrole","mkrole"], "Create a new role", ".createrole <name> [#hex]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageRoles)) return sendErr(msg.channel, "Missing ManageRoles permission.");
  const hex  = args.find(a => /^#?[0-9a-fA-F]{6}$/.test(a))?.replace("#","");
  const name = args.filter(a => !/^#?[0-9a-fA-F]{6}$/.test(a)).join(" ");
  if (!name) return sendErr(msg.channel, "Usage: " + PREFIX + "createrole <name> [#hex]");
  const role = await msg.guild.roles.create({ name, color: hex ? parseInt(hex,16) : 0, reason: "Created by " + msg.author.tag });
  const c = mc(role.color || 0x5865f2); c.addTextDisplayComponents(tx("## ✅ Role Created\n**" + role.name + "**  ·  ID: " + role.id));
  send(msg.channel, c);
});

reg("Tools", "deleterole", ["rmrole","remrole"], "Delete a role", ".deleterole @role", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageRoles)) return sendErr(msg.channel, "Missing ManageRoles permission.");
  const role = msg.mentions.roles.first(); if (!role) return sendErr(msg.channel, "Usage: " + PREFIX + "deleterole @role");
  confirm(msg, "Delete the role **" + role.name + "**? This cannot be undone.", async () => {
    await role.delete("Deleted by " + msg.author.tag);
    sendOk(msg.channel, "## ✅ Role Deleted\n**" + role.name + "** removed.");
  });
});

reg("Tools", "setcolor", ["rolecolor","rc"], "Change a role's color", ".setcolor @role <#hex>", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageRoles)) return sendErr(msg.channel, "Missing ManageRoles permission.");
  const role = msg.mentions.roles.first(), hex = args.find(a => /^#?[0-9a-fA-F]{6}$/.test(a))?.replace("#","");
  if (!role || !hex) return sendErr(msg.channel, "Usage: " + PREFIX + "setcolor @role #ff5733");
  await role.setColor(parseInt(hex,16));
  const c = mc(parseInt(hex,16)); c.addTextDisplayComponents(tx("## 🎨 Role Color Updated\n**" + role.name + "** → #" + hex.toUpperCase()));
  send(msg.channel, c);
});

reg("Tools", "createchannel", ["mkchannel","addchannel"], "Create a text channel", ".createchannel <name>", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  const name = args.join("-").replace(/\s+/g,"-").toLowerCase(); if (!name) return sendErr(msg.channel, "Usage: " + PREFIX + "createchannel <name>");
  const ch = await msg.guild.channels.create({ name, type: 0, reason: "Created by " + msg.author.tag });
  sendOk(msg.channel, "## ✅ Channel Created\n" + ch + "  ·  ID: " + ch.id);
});

reg("Tools", "percentage", ["pct","percent"], "Calculate a percentage", ".percentage <value> <total>", async (msg, args) => {
  const val = parseFloat(args[0]), total = parseFloat(args[1]);
  if (isNaN(val) || isNaN(total) || total === 0) return sendErr(msg.channel, "Usage: " + PREFIX + "percentage 45 200");
  const c = mc(); c.addTextDisplayComponents(tx("## % Percentage\n**" + val + "** out of **" + total + "** = **" + ((val/total)*100).toFixed(2) + "%**"));
  send(msg.channel, c);
});


reg("Fun", "roll", ["d","die"], "Roll a die", ".roll [sides]", async (msg, args) => {
  const sides = parseInt(args[0]) || 6; if (sides < 2 || sides > 10000) return sendErr(msg.channel, "Sides must be 2–10000.");
  const c = mc(0xeb459e); c.addTextDisplayComponents(tx("## 🎲 d" + sides + " → " + (Math.floor(Math.random()*sides)+1))); send(msg.channel, c);
});

reg("Fun", "dice", ["multidice"], "Roll multiple dice (e.g. 2d6)", ".dice <NdS>", async (msg, args) => {
  const match = args[0]?.match(/^(\d+)d(\d+)$/i); if (!match) return sendErr(msg.channel, "Usage: " + PREFIX + "dice 2d6");
  const num = Math.min(parseInt(match[1]),20), sides = Math.min(parseInt(match[2]),1000);
  if (num < 1 || sides < 2) return sendErr(msg.channel, "Invalid notation.");
  const rolls = Array.from({length:num}, () => Math.floor(Math.random()*sides)+1);
  const c = mc(0xeb459e); c.addTextDisplayComponents(tx("## 🎲 " + num + "d" + sides + "\nRolls: " + rolls.join(", ") + "\nTotal: **" + rolls.reduce((a,b)=>a+b,0) + "**")); send(msg.channel, c);
});

reg("Fun", "coinflip", ["cf","flip","toss"], "Heads or tails", ".coinflip", async (msg) => {
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 🪙 " + (Math.random() < 0.5 ? "Heads" : "Tails"))); send(msg.channel, c);
});

reg("Fun", "8ball", ["8b","ball","magic"], "Magic 8-ball", ".8ball <question>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "8ball <question>");
  const c = mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🎱 Magic 8-Ball")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Q:** " + args.join(" ") + "\n**A:** " + BALL[Math.floor(Math.random()*BALL.length)])); send(msg.channel, c);
});

reg("Fun", "choose", ["pick","pickone"], "Pick randomly from a list", ".choose a, b, c", async (msg, args) => {
  const opts = args.join(" ").split(",").map(s=>s.trim()).filter(Boolean); if (opts.length < 2) return sendErr(msg.channel, "Usage: " + PREFIX + "choose pizza, sushi, ramen");
  const c = mc(0x57f287); c.addTextDisplayComponents(tx("## 🤔 I choose: **" + opts[Math.floor(Math.random()*opts.length)] + "**\nOptions: " + opts.join(", "))); send(msg.channel, c);
});

reg("Fun", "calculate", ["calc","math"], "Math expression evaluator", ".calculate <expression>", async (msg, args) => {
  const expr = args.join(" "); if (!expr) return sendErr(msg.channel, "Usage: " + PREFIX + "calculate (10+5)*2");
  let result; try { if (!/^[0-9+\-*/(). %]+$/.test(expr)) throw 0; result = Function('"use strict";return(' + expr + ')')(); if (!isFinite(result)) throw 0; }
  catch { return sendErr(msg.channel, "Invalid expression: " + expr); }
  const c = mc(); c.addTextDisplayComponents(tx("## 🧮 " + expr + " = **" + result + "**")); send(msg.channel, c);
});

reg("Fun", "timestamp", ["ts","unix"], "Unix timestamp to Discord formats", ".timestamp <unix>", async (msg, args) => {
  const unix = parseInt(args[0]); if (isNaN(unix)) return sendErr(msg.channel, "Usage: " + PREFIX + "timestamp 1700000000");
  const c = mc(); c.addTextDisplayComponents(tx("## 🕒 Timestamp Formats")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(["t","T","d","D","f","F","R"].map(s => "**" + s + "** → <t:" + unix + ":" + s + ">  ·  <t:" + unix + ":" + s + ">").join("\n")));
  send(msg.channel, c);
});

reg("Fun", "random", ["rand","rng"], "Random number in a range", ".random <min> <max>", async (msg, args) => {
  const min = parseInt(args[0]), max = parseInt(args[1]); if (isNaN(min) || isNaN(max) || min >= max) return sendErr(msg.channel, "Usage: " + PREFIX + "random 1 100");
  const c = mc(0xeb459e); c.addTextDisplayComponents(tx("## 🎰 " + min + " – " + max + " → **" + (Math.floor(Math.random()*(max-min+1))+min) + "**")); send(msg.channel, c);
});

reg("Fun", "ship", ["love","lovecalc"], "Ship two users", ".ship @user1 @user2", async (msg) => {
  const users = [...msg.mentions.users.values()]; if (users.length < 2) return sendErr(msg.channel, "Usage: " + PREFIX + "ship @user1 @user2");
  const pct = Math.floor(Math.random()*101), bars = Math.round(pct/10), emoji = pct>=75?"💕":pct>=50?"💛":pct>=25?"🤔":"💔";
  const c = mc(0xff6b9d); c.addTextDisplayComponents(tx("## 💘 Ship\n**" + users[0].username + "** + **" + users[1].username + "**\n\n" + emoji + " **" + pct + "%** compatibility\n" + "█".repeat(bars) + "░".repeat(10-bars)));
  send(msg.channel, c);
});

reg("Fun", "rate", ["rateme","score"], "Rate something out of 10", ".rate <thing>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "rate pizza");
  const score = Math.floor(Math.random()*11);
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## ⭐ Rating\n**" + args.join(" ") + "**\n\n" + "⭐".repeat(score) + "☆".repeat(10-score) + "\n**" + score + " / 10**")); send(msg.channel, c);
});

reg("Fun", "roast", ["burn","insult"], "Roast someone", ".roast [@user]", async (msg) => {
  const target = msg.mentions.users.first()?.username ?? msg.author.username;
  const c = mc(0xed4245); c.addTextDisplayComponents(tx("## 🔥 Roast\n**" + target + "**, " + ROASTS[Math.floor(Math.random()*ROASTS.length)])); send(msg.channel, c);
});

reg("Fun", "compliment", ["comp","nice","praise"], "Compliment someone", ".compliment [@user]", async (msg) => {
  const target = msg.mentions.users.first()?.username ?? msg.author.username;
  const c = mc(0x57f287); c.addTextDisplayComponents(tx("## 💛 Compliment\n**" + target + "**, " + COMPLIMENTS[Math.floor(Math.random()*COMPLIMENTS.length)])); send(msg.channel, c);
});

reg("Fun", "fact", ["funfact","randomfact"], "Get a random fun fact", ".fact", async (msg) => {
  let data; try { data = await fetchJSON("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"); } catch { return sendErr(msg.channel, "Could not fetch a fact."); }
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 💡 Random Fact\n" + (data.text ?? "No fact found."))); send(msg.channel, c);
});

reg("Fun", "joke", ["jk","lol","funny"], "Get a random joke", ".joke", async (msg) => {
  let data; try { data = await fetchJSON("https://official-joke-api.appspot.com/random_joke"); } catch { return sendErr(msg.channel, "Could not fetch a joke."); }
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 😂 Joke\n" + data.setup + "\n\n||" + data.punchline + "||")); send(msg.channel, c);
});

reg("Fun", "quote", ["qte","inspire"], "Get a random quote", ".quote", async (msg) => {
  let data; try { data = await fetchJSON("https://zenquotes.io/api/random"); } catch { return sendErr(msg.channel, "Could not fetch a quote."); }
  const q = data[0];
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 💬 Quote\n\"" + q.q + "\"\n\n— " + q.a)); send(msg.channel, c);
});

reg("Fun", "dare", ["d2","challenge"], "Get a random dare", ".dare", async (msg) => {
  const c = mc(0xeb459e); c.addTextDisplayComponents(tx("## 😈 Dare\n" + DARES[Math.floor(Math.random()*DARES.length)])); send(msg.channel, c);
});

reg("Fun", "truth", ["tr","confess"], "Get a random truth question", ".truth", async (msg) => {
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 🤫 Truth\n" + TRUTHS[Math.floor(Math.random()*TRUTHS.length)])); send(msg.channel, c);
});

reg("Fun", "wyr", ["wouldyourather","wr"], "Get a would you rather question", ".wyr", async (msg) => {
  const c = mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🤔 Would You Rather\n" + WYR[Math.floor(Math.random()*WYR.length)])); send(msg.channel, c);
});

reg("Fun", "rps", ["rockpaperscissors"], "Rock paper scissors vs the bot", ".rps <rock|paper|scissors>", async (msg, args) => {
  const choices = ["rock","paper","scissors"], emojis = {rock:"🪨",paper:"📄",scissors:"✂️"}, beats = {rock:"scissors",paper:"rock",scissors:"paper"};
  const player2 = args[0]?.toLowerCase(); if (!choices.includes(player2)) return sendErr(msg.channel, "Usage: " + PREFIX + "rps rock / paper / scissors");
  const bot = choices[Math.floor(Math.random()*3)];
  const result = player2===bot?"Draw!":beats[player2]===bot?"You Win! 🎉":"Bot Wins! 🤖";
  const c = mc(beats[player2]===bot?0x57f287:player2===bot?0xfee75c:0xed4245);
  c.addTextDisplayComponents(tx("## ✂️ Rock Paper Scissors\n**You:** " + emojis[player2] + " " + player2 + "\n**Bot:** " + emojis[bot] + " " + bot + "\n\n**" + result + "**")); send(msg.channel, c);
});

reg("Fun", "slot", ["slots","slotmachine"], "Play the slot machine", ".slot", async (msg) => {
  const symbols = ["🍒","🍋","🍊","🍇","⭐","💎","🎰","7️⃣"];
  const reels   = Array.from({length:3}, () => symbols[Math.floor(Math.random()*symbols.length)]);
  const win     = reels.every(r=>r===reels[0]), jackpot = win && reels[0]==="7️⃣";
  const c = mc(jackpot?0xffd700:win?0x57f287:0x5865f2);
  c.addTextDisplayComponents(tx("## 🎰 Slot Machine\n" + reels.join("  ") + "\n\n" + (jackpot?"**JACKPOT! 🎉🎉🎉**":win?"**Winner! 🎉**":"No match. Try again!")));
  send(msg.channel, c);
});

reg("Fun", "affirmation", ["affirm","selfcare"], "Get a positive affirmation", ".affirmation", async (msg) => {
  const c = mc(0xf4a7b9); c.addTextDisplayComponents(tx("## 🌸 Affirmation\n" + AFFIRMATIONS[Math.floor(Math.random()*AFFIRMATIONS.length)])); send(msg.channel, c);
});

reg("Fun", "horoscope", ["horo","zodiac","starsign"], "Get info about a zodiac sign", ".horoscope <sign>", async (msg, args) => {
  const sign = args[0]?.toLowerCase().replace(/[^a-z]/g,""), data = ZODIAC[sign];
  if (!data) return sendErr(msg.channel, "Unknown sign. Options: " + Object.keys(ZODIAC).join(", "));
  const c = mc(0x9b59b6); c.addTextDisplayComponents(tx("## " + data.symbol + " " + sign.charAt(0).toUpperCase() + sign.slice(1))); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Dates:** " + data.dates + "\n**Traits:** " + data.trait)); send(msg.channel, c);
});

reg("Fun", "catfact", ["cat","meow","cats"], "Get a random cat fact", ".catfact", async (msg) => {
  let data; try { data = await fetchJSON("https://catfact.ninja/fact"); } catch { return sendErr(msg.channel, "Could not fetch a cat fact."); }
  const c = mc(0xf39c12); c.addTextDisplayComponents(tx("## 🐱 Cat Fact\n" + data.fact)); send(msg.channel, c);
});

reg("Fun", "dogfact", ["dog","woof","dogs"], "Get a random dog fact", ".dogfact", async (msg) => {
  let data; try { data = await fetchJSON("https://dogapi.dog/api/v2/facts"); } catch { return sendErr(msg.channel, "Could not fetch a dog fact."); }
  const fact = data.data?.[0]?.attributes?.body; if (!fact) return sendErr(msg.channel, "No dog fact received.");
  const c = mc(0xa0522d); c.addTextDisplayComponents(tx("## 🐶 Dog Fact\n" + fact)); send(msg.channel, c);
});

reg("Fun", "riddle", ["puzzle","rd"], "Get a random riddle", ".riddle", async (msg) => {
  const riddles = [["I speak without a mouth and hear without ears. What am I?","An echo"],["The more you take, the more you leave behind. What am I?","Footsteps"],["What has keys but no locks, space but no room, and you can enter but can't go inside?","A keyboard"],["I go up but never come down. What am I?","Your age"],["What has hands but can't clap?","A clock"]];
  const [q, a] = riddles[Math.floor(Math.random()*riddles.length)];
  const c = mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🧩 Riddle\n" + q + "\n\n-# Answer: ||" + a + "||")); send(msg.channel, c);
});

reg("Fun", "trivia", ["quiz","q"], "Get a random trivia question", ".trivia", async (msg) => {
  let data; try { data = await fetchJSON("https://opentdb.com/api.php?amount=1&type=multiple"); } catch { return sendErr(msg.channel, "Could not fetch trivia."); }
  const q = data.results?.[0]; if (!q) return sendErr(msg.channel, "No trivia received.");
  const all = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random()-0.5);
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 🧠 Trivia")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Category:** " + htmlDecode(q.category) + "\n**Difficulty:** " + q.difficulty + "\n\n" + htmlDecode(q.question) + "\n\n" + all.map((a,i) => (i+1) + ".  " + htmlDecode(a)).join("\n") + "\n\n-# Answer: ||" + htmlDecode(q.correct_answer) + "||"));
  send(msg.channel, c);
});

reg("Fun", "reverse", ["rev"], "Reverse text", ".reverse <text>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "reverse <text>");
  const c = mc(); c.addTextDisplayComponents(tx("## 🔄 " + args.join(" ").split("").reverse().join(""))); send(msg.channel, c);
});

reg("Fun", "mock", ["spongebob","sb"], "SpOnGeBoB mock text", ".mock <text>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "mock <text>");
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 🧽 " + args.join(" ").split("").map((ch,i)=>i%2?ch.toUpperCase():ch.toLowerCase()).join(""))); send(msg.channel, c);
});

reg("Fun", "clap", ["claptext"], "Add 👏 between words", ".clap <text>", async (msg, args) => {
  if (!args.length) return sendErr(msg.channel, "Usage: " + PREFIX + "clap <text>");
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 👏 " + args.join(" 👏 ") + " 👏")); send(msg.channel, c);
});

reg("Fun", "never", ["nhie"], "Never have I ever question", ".never", async (msg) => {
  const questions = ["Never have I ever stayed up past 3am for no reason.","Never have I ever googled myself.","Never have I ever cried at a movie.","Never have I ever sent a text to the wrong person.","Never have I ever faked being sick to skip something."];
  const c = mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🙅 Never Have I Ever\n" + questions[Math.floor(Math.random()*questions.length)])); send(msg.channel, c);
});


const ACTION_DEFS = [
  ["slap","sl","slapped"],["bonk","bnk","bonked"],["punch","pnch","punched"],["kick","kck","kicked"],
  ["bite","bt","bit"],["yeet","yt","yeeted"],["poke","pok","poked"],["tickle","tckl","tickled"],
  ["hug","hg","hugged"],["pat","hp","patted"],["kiss","kss","kissed"],["cuddle","cdl","cuddled with"],
  ["feed","fd","fed"],["handhold","hh","held hands with"],["highfive","hf","high fived"],
  ["wave","wv","waved at"],["handshake","hs","shook hands with"],["blush","blsh","blushed at"],
  ["smile","grin","smiled at"],["laugh","lgh","laughed at"],["cry","sob","cried at"],
  ["pout","pt","pouted at"],["stare","str","stared at"],["shrug","shrg","shrugged at"],
  ["facepalm","fp","facepalmed at"],["dance","dnc","danced with"],["wink","wnk","winked at"],
];

for (const [endpoint, alias, verb] of ACTION_DEFS) {
  reg("Actions", endpoint, [alias], verb.charAt(0).toUpperCase() + verb.slice(1) + " someone", "." + endpoint + " [@user]", async (msg) => {
    const target = msg.mentions.users.first();
    const label  = target ? "<@" + msg.author.id + "> " + verb + " <@" + target.id + ">" : "<@" + msg.author.id + "> " + verb;
    const embed  = new EmbedBuilder().setDescription(label).setColor(0x5865f2);
    const sent   = await msg.channel.send({ embeds: [embed] });
    fetchJSON("https://nekos.best/api/v2/" + endpoint).then(data => {
      const gif = data.results?.[0]?.url;
      if (gif) sent.edit({ embeds: [EmbedBuilder.from(sent.embeds[0]).setImage(gif)] });
    }).catch(() => {});
  });
}


reg("AFK", "afk", ["away","brb"], "Set your AFK status", ".afk [reason]", async (msg, args) => {
  if (args.length) {
    afkStore.set(msg.author.id, { reason: args.join(" "), since: Date.now() });
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 💤 AFK Set\n**Reason:** " + args.join(" "))); return send(msg.channel, c);
  }
  const key = "afk:" + msg.author.id;
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 💤 Set AFK\nClick below to set your AFK reason."));
  msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Set AFK Reason")], flags: F, allowedMentions: { parse: [] } });
});

reg("AFK", "afklist", ["afkall","listafk"], "Show everyone currently AFK", ".afklist", async (msg) => {
  if (!afkStore.size) return sendErr(msg.channel, "Nobody is AFK right now.");
  const list = [...afkStore.entries()];
  paginate(msg.channel, msg.author.id, list, 10, ([id, d]) => "<@" + id + "> — " + d.reason + " (" + fmtDur(Date.now()-d.since) + " ago)", "💤 AFK Members (" + list.length + ")");
});

reg("AFK", "unafk", ["removeafk","clearafk"], "Remove someone's AFK status (mod only)", ".unafk @user", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ModerateMembers)) return sendErr(msg.channel, "Missing ModerateMembers permission.");
  const target = msg.mentions.users.first(); if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "unafk @user");
  if (!afkStore.has(target.id)) return sendErr(msg.channel, "**" + target.username + "** is not AFK.");
  afkStore.delete(target.id);
  sendOk(msg.channel, "## ✅ AFK Removed\n**" + target.tag + "** is no longer AFK.");
});


reg("Snipe", "snipe", ["sn"], "Show the last deleted message", ".snipe", async (msg) => {
  const d = snipeStore.get(msg.channel.id); if (!d) return sendErr(msg.channel, "Nothing to snipe in this channel.");
  const c = mc(); c.addTextDisplayComponents(tx("## 🔍 Sniped")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Author:** " + d.author + "\n**Deleted:** <t:" + Math.floor(d.at/1000) + ":R>\n\n" + (d.content || "(no text)"))); send(msg.channel, c);
});

reg("Snipe", "editsnipe", ["es","esnipe"], "Show the last edited message", ".editsnipe", async (msg) => {
  const d = esnipeStore.get(msg.channel.id); if (!d) return sendErr(msg.channel, "Nothing to editsnipe in this channel.");
  const c = mc(); c.addTextDisplayComponents(tx("## ✏️ Edit Sniped")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Author:** " + d.author + "\n**Edited:** <t:" + Math.floor(d.at/1000) + ":R>\n\n**Before:**\n" + (d.before||"(empty)") + "\n\n**After:**\n" + (d.after||"(empty)"))); send(msg.channel, c);
});

reg("Snipe", "clearsnipe", ["cs2","wipesnipe"], "Clear the snipe cache for this channel", ".clearsnipe", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageMessages)) return sendErr(msg.channel, "Missing ManageMessages permission.");
  snipeStore.delete(msg.channel.id); esnipeStore.delete(msg.channel.id);
  sendOk(msg.channel, "## ✅ Snipe Cleared");
});


reg("Reminders", "remind", ["reminder","remindme"], "Set a timed reminder", ".remind <time> <message>", async (msg, args) => {
  const ms = parseTime(args[0]), text = args.slice(1).join(" ");
  if (ms && text) {
    const fireAt = Date.now() + ms;
    reminders.push({ id: msg.author.id + "-" + fireAt, userId: msg.author.id, channelId: msg.channel.id, message: text, fireAt });
    const c = mc(0x57f287); c.addTextDisplayComponents(tx("## ⏰ Reminder Set\n**Message:** " + text + "\n**Fires:** <t:" + Math.floor(fireAt/1000) + ":R>\n**Duration:** " + fmtDur(ms))); return send(msg.channel, c);
  }
  const key = "remind:" + msg.author.id + ":" + msg.channel.id;
  const c = mc(0x57f287); c.addTextDisplayComponents(tx("## ⏰ Set Reminder\nClick below to set your reminder details."));
  msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Set Reminder")], flags: F, allowedMentions: { parse: [] } });
});

reg("Reminders", "reminders", ["rms","myreminders"], "List your active reminders", ".reminders", async (msg) => {
  const mine = reminders.filter(r => r.userId === msg.author.id); if (!mine.length) return sendErr(msg.channel, "You have no active reminders.");
  paginate(msg.channel, msg.author.id, mine, 10, (r, i) => "**" + (i+1) + ".** " + r.message + " — <t:" + Math.floor(r.fireAt/1000) + ":R>", "⏰ Your Reminders");
});

reg("Reminders", "cancelreminder", ["cr","delreminder"], "Cancel a reminder by number", ".cancelreminder <number>", async (msg, args) => {
  const mine = reminders.filter(r => r.userId === msg.author.id), num = parseInt(args[0]);
  if (isNaN(num) || num < 1 || num > mine.length) return sendErr(msg.channel, "Usage: " + PREFIX + "cancelreminder <number>  —  see " + PREFIX + "reminders");
  const target = mine[num-1]; reminders.splice(reminders.findIndex(r => r.id === target.id), 1);
  sendOk(msg.channel, "## ✅ Cancelled\n**" + target.message + "** removed.");
});


reg("Voice", "vcmove", ["move","vm"], "Move a user to a voice channel", ".vcmove @user #channel", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MoveMembers)) return sendErr(msg.channel, "Missing MoveMembers permission.");
  const target = msg.mentions.members.first(), channel = msg.mentions.channels.first();
  if (!target || !channel) return sendErr(msg.channel, "Usage: " + PREFIX + "vcmove @user #channel");
  if (!target.voice.channel) return sendErr(msg.channel, "That user is not in a voice channel.");
  await target.voice.setChannel(channel);
  sendOk(msg.channel, "## ✅ Moved\n**" + target.user.tag + "** → " + channel);
});

reg("Voice", "vckick", ["vk","disconnect","dvc"], "Disconnect a user from voice", ".vckick @user", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MoveMembers)) return sendErr(msg.channel, "Missing MoveMembers permission.");
  const target = msg.mentions.members.first(); if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "vckick @user");
  if (!target.voice.channel) return sendErr(msg.channel, "That user is not in a voice channel.");
  await target.voice.disconnect();
  sendOk(msg.channel, "## ✅ VC Kick\n**" + target.user.tag + "** disconnected.");
});

reg("Voice", "vcmute", ["servermute","smute"], "Server-mute a user in voice", ".vcmute @user", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MuteMembers)) return sendErr(msg.channel, "Missing MuteMembers permission.");
  const target = msg.mentions.members.first(); if (!target || !target.voice.channel) return sendErr(msg.channel, "User not in a voice channel.");
  await target.voice.setMute(true); sendOk(msg.channel, "## 🔇 VC Muted\n**" + target.user.tag + "** server-muted.");
});

reg("Voice", "vcunmute", ["serverunmute","sunmute"], "Remove server-mute from a user", ".vcunmute @user", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MuteMembers)) return sendErr(msg.channel, "Missing MuteMembers permission.");
  const target = msg.mentions.members.first(); if (!target || !target.voice.channel) return sendErr(msg.channel, "User not in a voice channel.");
  await target.voice.setMute(false); sendOk(msg.channel, "## 🔊 VC Unmuted\n**" + target.user.tag + "** unmuted.");
});

reg("Voice", "vcdeafen", ["serverdeafen","sdeafen"], "Server-deafen a user in voice", ".vcdeafen @user", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.DeafenMembers)) return sendErr(msg.channel, "Missing DeafenMembers permission.");
  const target = msg.mentions.members.first(); if (!target || !target.voice.channel) return sendErr(msg.channel, "User not in a voice channel.");
  await target.voice.setDeaf(true); sendOk(msg.channel, "## 🔕 VC Deafened\n**" + target.user.tag + "** server-deafened.");
});

reg("Voice", "massmove", ["mm","moveall"], "Move all users from one VC to another", ".massmove #from #to", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MoveMembers)) return sendErr(msg.channel, "Missing MoveMembers permission.");
  const chans = [...msg.mentions.channels.values()]; if (chans.length < 2) return sendErr(msg.channel, "Usage: " + PREFIX + "massmove #from-vc #to-vc");
  const [from, to] = chans; if (!from.members?.size) return sendErr(msg.channel, "No members in that channel.");
  for (const [, m] of from.members) await m.voice.setChannel(to).catch(() => {});
  sendOk(msg.channel, "## ✅ Mass Moved\nMoved **" + from.members.size + "** member(s) to " + to + ".");
});

reg("Voice", "vcmuteall", ["vma","mutevc"], "Server-mute all users in your VC", ".vcmuteall", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MuteMembers)) return sendErr(msg.channel, "Missing MuteMembers permission.");
  const ch = msg.member.voice.channel; if (!ch) return sendErr(msg.channel, "You are not in a voice channel.");
  for (const [, m] of ch.members) if (!m.user.bot) await m.voice.setMute(true).catch(() => {});
  sendOk(msg.channel, "## 🔇 VC Mute All\nMuted everyone in **" + ch.name + "**.");
});

reg("Voice", "vcunmuteall", ["vuma","unmutevc"], "Remove server-mute from all in your VC", ".vcunmuteall", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MuteMembers)) return sendErr(msg.channel, "Missing MuteMembers permission.");
  const ch = msg.member.voice.channel; if (!ch) return sendErr(msg.channel, "You are not in a voice channel.");
  for (const [, m] of ch.members) if (!m.user.bot) await m.voice.setMute(false).catch(() => {});
  sendOk(msg.channel, "## 🔊 VC Unmute All\nUnmuted everyone in **" + ch.name + "**.");
});

reg("Voice", "vcstatus", ["vcs","setstatus","voicestatus"], "Set or clear your voice channel status", ".vcstatus <text> | .vcstatus clear", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.MuteMembers)) return sendErr(msg.channel, "Missing MuteMembers permission.");
  const ch = msg.member.voice?.channel; if (!ch) return sendErr(msg.channel, "You are not in a voice channel.");
  const text = args.join(" ").trim(); if (!text) return sendErr(msg.channel, "Usage: " + PREFIX + "vcstatus <text>  or  " + PREFIX + "vcstatus clear");
  const status = text.toLowerCase() === "clear" ? "" : text;
  await client.rest.put("/channels/" + ch.id + "/voice-status", { body: { status } });
  sendOk(msg.channel, status ? "## ✅ VC Status Set\n**" + ch.name + "** → " + status : "## ✅ VC Status Cleared\n**" + ch.name + "**");
});


reg("Moderation", "kick", ["k"], "Kick a member", ".kick @user [reason]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.KickMembers)) return sendErr(msg.channel, "Missing KickMembers permission.");
  const target = msg.mentions.members.first(); if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "kick @user [reason]");
  if (!target.kickable) return sendErr(msg.channel, "I can't kick that user.");
  const reason = args.slice(1).join(" ") || "No reason provided";
  confirm(msg, "Kick **" + target.user.tag + "**?\n**Reason:** " + reason, async () => {
    await target.kick(reason);
    const c = mc(0xed4245); c.addTextDisplayComponents(tx("## 👢 Kicked\n**User:** " + target.user.tag + "\n**Reason:** " + reason + "\n**Mod:** " + msg.author.tag)); send(msg.channel, c);
  });
});

reg("Moderation", "ban", ["b"], "Ban a member", ".ban @user [days] [reason]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.BanMembers)) return sendErr(msg.channel, "Missing BanMembers permission.");
  const target = msg.mentions.members.first(); if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "ban @user [days] [reason]");
  if (!target.bannable) return sendErr(msg.channel, "I can't ban that user.");
  let rest = args.slice(1); const days = !isNaN(parseInt(rest[0])) && parseInt(rest[0]) <= 7 ? parseInt(rest.shift()) : 0;
  const reason = rest.join(" ") || "No reason provided";
  confirm(msg, "Ban **" + target.user.tag + "**?\n**Reason:** " + reason + "\n**Msg delete:** " + days + " day(s)", async () => {
    await target.ban({ deleteMessageDays: days, reason });
    const c = mc(0xed4245); c.addTextDisplayComponents(tx("## 🔨 Banned\n**User:** " + target.user.tag + "\n**Reason:** " + reason + "\n**Msg Delete:** " + days + "d\n**Mod:** " + msg.author.tag)); send(msg.channel, c);
  });
});

reg("Moderation", "softban", ["sban"], "Ban + unban to wipe messages", ".softban @user [reason]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.BanMembers)) return sendErr(msg.channel, "Missing BanMembers permission.");
  const target = msg.mentions.members.first(); if (!target || !target.bannable) return sendErr(msg.channel, "Usage: " + PREFIX + "softban @user [reason]");
  const reason = args.slice(1).join(" ") || "No reason provided";
  confirm(msg, "Softban **" + target.user.tag + "**? (kick + wipe 7 days of messages)", async () => {
    await target.ban({ deleteMessageDays: 7, reason: "Softban: " + reason });
    await msg.guild.members.unban(target.id);
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 🪃 Softbanned\n**User:** " + target.user.tag + "\n**Reason:** " + reason)); send(msg.channel, c);
  });
});

reg("Moderation", "unban", ["ub","pardon"], "Unban a user by ID", ".unban <userID>", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.BanMembers)) return sendErr(msg.channel, "Missing BanMembers permission.");
  if (!args[0]) return sendErr(msg.channel, "Usage: " + PREFIX + "unban <userID>");
  try { const ban = await msg.guild.bans.fetch(args[0]); await msg.guild.members.unban(args[0]); sendOk(msg.channel, "## ✅ Unbanned\n**" + ban.user.tag + "**"); }
  catch { sendErr(msg.channel, "No ban found for " + args[0] + "."); }
});

reg("Moderation", "banlist", ["bans","bl"], "Show all banned users", ".banlist", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.BanMembers)) return sendErr(msg.channel, "Missing BanMembers permission.");
  const bans = await msg.guild.bans.fetch(); if (!bans.size) return sendErr(msg.channel, "No banned users.");
  paginate(msg.channel, msg.author.id, [...bans.values()], 10, b => "**" + b.user.tag + "** — " + (b.reason || "No reason"), "🔨 Ban List (" + bans.size + ")", 0xed4245);
});

reg("Moderation", "warn", ["w2","warning"], "Warn a member via DM", ".warn @user [reason]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ModerateMembers)) return sendErr(msg.channel, "Missing ModerateMembers permission.");
  const target = msg.mentions.members.first(); if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "warn @user [reason]");
  const inlineReason = args.slice(1).join(" ");
  if (inlineReason) {
    const dmC = mc(0xfee75c); dmC.addTextDisplayComponents(tx("## ⚠️ Warning from **" + msg.guild.name + "**\n**Reason:** " + inlineReason));
    await target.send({ components: [dmC], flags: F }).catch(() => {});
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## ⚠️ Warned\n**User:** " + target.user.tag + "\n**Reason:** " + inlineReason + "\n**Mod:** " + msg.author.tag)); return send(msg.channel, c);
  }
  const key = "warn:" + msg.author.id + ":" + target.id + ":" + msg.guild.id;
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## ⚠️ Warn " + target.user.tag + "\nClick below to write the warning reason."));
  msg.channel.send({ components: [c, modalBtn("openmodal:" + key, "Write Reason")], flags: F, allowedMentions: { parse: [] } });
});

reg("Moderation", "timeout", ["mute","to"], "Timeout a member", ".timeout @user <minutes> [reason]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ModerateMembers)) return sendErr(msg.channel, "Missing ModerateMembers permission.");
  const target = msg.mentions.members.first(), mins = parseInt(args[1]);
  if (!target || isNaN(mins) || mins < 1) return sendErr(msg.channel, "Usage: " + PREFIX + "timeout @user <minutes> [reason]");
  if (!target.moderatable) return sendErr(msg.channel, "I can't timeout that user.");
  const reason = args.slice(2).join(" ") || "No reason provided";
  await target.timeout(mins * 60000, reason);
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## ⏱️ Timed Out\n**User:** " + target.user.tag + "\n**Duration:** " + mins + "m\n**Reason:** " + reason + "\n**Mod:** " + msg.author.tag)); send(msg.channel, c);
});

reg("Moderation", "untimeout", ["unmute","uto"], "Remove a timeout", ".untimeout @user", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ModerateMembers)) return sendErr(msg.channel, "Missing ModerateMembers permission.");
  const target = msg.mentions.members.first(); if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "untimeout @user");
  await target.timeout(null); sendOk(msg.channel, "## ✅ Timeout Removed\n**" + target.user.tag + "**");
});

reg("Moderation", "purge", ["clear","clean"], "Bulk delete messages", ".purge <amount> [@user]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageMessages)) return sendErr(msg.channel, "Missing ManageMessages permission.");
  const amount = parseInt(args[0]); if (isNaN(amount) || amount < 1 || amount > 100) return sendErr(msg.channel, "Usage: " + PREFIX + "purge <1–100> [@user]");
  const filterUser = msg.mentions.users.first();
  confirm(msg, "Delete **" + amount + "** message(s)" + (filterUser ? " from **" + filterUser.tag + "**" : "") + "?\nThis cannot be undone.", async () => {
    await msg.delete().catch(() => {});
    let msgs = await msg.channel.messages.fetch({ limit: filterUser ? 100 : amount });
    if (filterUser) msgs = msgs.filter(m => m.author.id === filterUser.id).first(amount);
    const deleted = await msg.channel.bulkDelete(msgs, true).catch(() => null);
    const m = await sendOk(msg.channel, "## 🗑️ Purged " + (deleted?.size ?? 0) + " message(s)" + (filterUser ? " from **" + filterUser.tag + "**" : "") + ".");
    setTimeout(() => m.delete().catch(() => {}), 5000);
  });
});

reg("Moderation", "nick", ["nickname","setnick"], "Change a member's nickname", ".nick @user <name|reset>", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageNicknames)) return sendErr(msg.channel, "Missing ManageNicknames permission.");
  const target = msg.mentions.members.first(), newNick = args.slice(1).join(" ");
  if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "nick @user <n>  or  " + PREFIX + "nick @user reset");
  const reset = newNick.toLowerCase() === "reset"; await target.setNickname(reset ? null : newNick);
  sendOk(msg.channel, reset ? "## ✅ Nickname Reset\n**" + target.user.tag + "**" : "## ✅ Nickname Changed\n**" + target.user.tag + "** → " + newNick);
});

reg("Moderation", "slowmode", ["slow","sm","ratelimit"], "Set channel slowmode", ".slowmode <seconds>", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  const secs = parseInt(args[0]); if (isNaN(secs) || secs < 0 || secs > 21600) return sendErr(msg.channel, "Usage: " + PREFIX + "slowmode <0–21600>");
  await msg.channel.setRateLimitPerUser(secs);
  sendOk(msg.channel, secs === 0 ? "## ✅ Slowmode Disabled" : "## 🐢 Slowmode: " + secs + "s");
});

reg("Moderation", "lock", ["lockdown","lockch"], "Lock a channel", ".lock", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });
  const c = mc(0xed4245); c.addTextDisplayComponents(tx("## 🔒 Locked\n-# Mod: " + msg.author.tag)); send(msg.channel, c);
});

reg("Moderation", "unlock", ["unlockdown"], "Unlock a channel", ".unlock", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: null });
  const c = mc(0x57f287); c.addTextDisplayComponents(tx("## 🔓 Unlocked\n-# Mod: " + msg.author.tag)); send(msg.channel, c);
});

reg("Moderation", "nuke", ["wipe","resetchannel"], "Clone + wipe a channel", ".nuke [reason]", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  const reason = args.join(" ") || "Channel nuked";
  confirm(msg, "Nuke **#" + msg.channel.name + "**?\nThis will delete and recreate the channel, wiping all messages.", async () => {
    const pos = msg.channel.position, newCh = await msg.channel.clone({ reason });
    await newCh.setPosition(pos); await msg.channel.delete(reason);
    const c = mc(0xed4245); c.addTextDisplayComponents(tx("## 💥 Nuked\n-# Mod: " + msg.author.tag)); send(newCh, c);
  });
});

reg("Moderation", "hide", ["hchan","hidechannel"], "Hide channel from @everyone", ".hide", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { ViewChannel: false });
  const c = mc(0xed4245); c.addTextDisplayComponents(tx("## 👁️ Channel Hidden\n-# Mod: " + msg.author.tag)); send(msg.channel, c);
});

reg("Moderation", "show", ["unhide","showchannel"], "Show channel to @everyone", ".show", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { ViewChannel: null });
  const c = mc(0x57f287); c.addTextDisplayComponents(tx("## 👁️ Channel Visible\n-# Mod: " + msg.author.tag)); send(msg.channel, c);
});

reg("Moderation", "dehoist", ["dh"], "Remove leading ! from a nickname", ".dehoist @user", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageNicknames)) return sendErr(msg.channel, "Missing ManageNicknames permission.");
  const target = msg.mentions.members.first(); if (!target) return sendErr(msg.channel, "Usage: " + PREFIX + "dehoist @user");
  if (!target.displayName.startsWith("!")) return sendErr(msg.channel, "**" + target.user.username + "** is not hoisting.");
  await target.setNickname(target.displayName.replace(/^!+/, ""));
  sendOk(msg.channel, "## ✅ Dehoisted\n**" + target.user.tag + "**");
});

reg("Moderation", "clearreacts", ["cr2"], "Remove all reactions from a message", ".clearreacts <messageID>", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageMessages)) return sendErr(msg.channel, "Missing ManageMessages permission.");
  if (!args[0]) return sendErr(msg.channel, "Usage: " + PREFIX + "clearreacts <messageID>");
  try { const target = await msg.channel.messages.fetch(args[0]); await target.reactions.removeAll(); sendOk(msg.channel, "## ✅ Reactions Cleared"); }
  catch { sendErr(msg.channel, "Message not found in this channel."); }
});

reg("Moderation", "rename", ["ren"], "Rename the current channel", ".rename <name>", async (msg, args) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  const name = args.join("-").replace(/\s+/g,"-").toLowerCase(); if (!name) return sendErr(msg.channel, "Usage: " + PREFIX + "rename <name>");
  const old = msg.channel.name; await msg.channel.setName(name);
  sendOk(msg.channel, "## ✅ Channel Renamed\n**" + old + "** → **" + name + "**");
});

reg("Moderation", "lockall", ["lockserver"], "Lock all text channels", ".lockall", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.Administrator)) return sendErr(msg.channel, "Missing Administrator permission.");
  confirm(msg, "Lock **all text channels** in this server?", async () => {
    for (const [, ch] of msg.guild.channels.cache.filter(c => c.type === 0)) await ch.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false }).catch(() => {});
    sendOk(msg.channel, "## 🔒 Server Locked\nAll text channels locked.\n-# Mod: " + msg.author.tag);
  });
});

reg("Moderation", "unlockall", ["unlockserver"], "Unlock all text channels", ".unlockall", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.Administrator)) return sendErr(msg.channel, "Missing Administrator permission.");
  confirm(msg, "Unlock **all text channels** in this server?", async () => {
    for (const [, ch] of msg.guild.channels.cache.filter(c => c.type === 0)) await ch.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: null }).catch(() => {});
    sendOk(msg.channel, "## 🔓 Server Unlocked\nAll text channels unlocked.\n-# Mod: " + msg.author.tag);
  });
});

reg("Moderation", "archivechannel", ["archive","readonly"], "Make a channel read-only", ".archivechannel", async (msg) => {
  if (!hasPerm(msg.member, PermissionFlagsBits.ManageChannels)) return sendErr(msg.channel, "Missing ManageChannels permission.");
  confirm(msg, "Archive **#" + msg.channel.name + "**? (@everyone will no longer be able to send or react.)", async () => {
    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false, AddReactions: false });
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 📦 Channel Archived\n" + msg.channel + " is now read-only.\n-# Mod: " + msg.author.tag)); send(msg.channel, c);
  });
});


async function handleButton(interaction) {
  const id = interaction.customId;

  if (id.startsWith("music:")) {
    const queue = kazagumo.players.get(interaction.guild.id);
    if (!queue?.current) {
      const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  Nothing is playing right now."));
      return interaction.reply(eph(c));
    }
    if (!interaction.guild.members.cache.get(interaction.user.id)?.voice.channel) {
      const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  You need to be in a voice channel."));
      return interaction.reply(eph(c));
    }
    const action = id.slice(6);
    if (action === "skip")       { queue.skip(); return interaction.deferUpdate(); }
    if (action === "stop")       { queue.destroy(); await interaction.deferUpdate(); const c = mc(0xed4245); c.addTextDisplayComponents(tx("## ⏹️ Stopped")); return interaction.message.edit({ components: [c], flags: F }); }
    if (action === "playpause")  { queue.pause(!queue.paused); await interaction.deferUpdate(); return interaction.message.edit(buildNowPlaying(queue, queue.current)); }
    if (action === "shuffle")    { if (queue.queue.length < 2) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  Not enough tracks.")); return interaction.reply(eph(c)); } queue.queue.shuffle(); await interaction.deferUpdate(); return interaction.message.edit(buildNowPlaying(queue, queue.current)); }
    if (action === "loop")       { const loopArr = ["none","track","queue"]; const next = loopArr[(loopArr.indexOf(queue.loop) + 1) % 3]; queue.setLoop(next); await interaction.deferUpdate(); return interaction.message.edit(buildNowPlaying(queue, queue.current)); }
    if (action === "clearqueue") { queue.queue.splice(0, queue.queue.length); await interaction.deferUpdate(); return interaction.message.edit(buildNowPlaying(queue, queue.current)); }
    if (action === "prev")       {
      const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  Previous track not supported."));
      return interaction.reply(eph(c));
    }
    if (action === "volume") {
      return interaction.showModal(buildModal("modal:volume:" + interaction.message.id, "Set Volume",
        input("volume", "Volume (1–100)", TextInputStyle.Short, { placeholder: "Enter 1–100", value: String(queue.volume), max: 3, min: 1 })
      ));
    }
    return;
  }

  if (id.startsWith("confirm:")) {
    const key = id.slice(8), action = pendingConfirm.get(key);
    if (!action) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  This confirmation has expired.")); return interaction.reply(eph(c)); }
    if (action.uid !== interaction.user.id) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  This confirmation is not for you.")); return interaction.reply(eph(c)); }
    pendingConfirm.delete(key);
    await interaction.deferUpdate();
    const c = mc(0x57f287); c.addTextDisplayComponents(tx("✅ Confirmed — executing..."));
    await interaction.message.edit({ components: [c], flags: F }).catch(() => {});
    await action.fn();
    return;
  }

  if (id.startsWith("cancel:")) {
    const key = id.slice(7), action = pendingConfirm.get(key);
    if (action && action.uid !== interaction.user.id) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  This confirmation is not for you.")); return interaction.reply(eph(c)); }
    pendingConfirm.delete(key);
    await interaction.deferUpdate();
    return interaction.message.delete().catch(() => {});
  }

  if (id.startsWith("pg:")) {
    const parts = id.split(":");
    const dir   = parts[1];
    const pgId  = parts[2] + ":" + parts[3] + ":" + parts[4];
    const curPg = parseInt(parts[5]);
    const p     = pageStore.get(pgId);
    if (!p) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  This list has expired.")); return interaction.reply(eph(c)); }
    const newPg = dir === "prev" ? curPg - 1 : curPg + 1;
    if (newPg < 0 || newPg >= p.total) return interaction.deferUpdate();
    const slice = p.items.slice(newPg * p.perPage, (newPg + 1) * p.perPage);
    const c = mc(p.color);
    c.addTextDisplayComponents(tx("## " + p.title + "\n-# Page " + (newPg + 1) + " of " + p.total + "  ·  " + p.items.length + " total")); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx(slice.map(p.rowFn).join("\n")));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("pg:prev:" + pgId + ":" + newPg).setLabel("← Prev").setStyle(ButtonStyle.Secondary).setDisabled(newPg === 0),
      new ButtonBuilder().setCustomId("pg:next:" + pgId + ":" + newPg).setLabel("Next →").setStyle(ButtonStyle.Secondary).setDisabled(newPg >= p.total - 1)
    );
    return interaction.update({ components: [c, row], flags: F, allowedMentions: { parse: [] } });
  }

  if (id.startsWith("openmodal:")) {
    const key   = id.slice(10);
    const parts = key.split(":");
    const type  = parts[0];
    if (type === "say")       return interaction.showModal(buildModal("modal:" + key, "Say Something",       input("message","Message",     TextInputStyle.Paragraph, { placeholder: "Type what the bot should say...", max: 2000 })));
    if (type === "announce")  return interaction.showModal(buildModal("modal:" + key, "Write Announcement",  input("message","Announcement", TextInputStyle.Paragraph, { placeholder: "Your announcement...", max: 2000 })));
    if (type === "poll")      return interaction.showModal(buildModal("modal:" + key, "Create Poll",         input("question","Question",   TextInputStyle.Short,     { placeholder: "What do you want to ask?", max: 200 })));
    if (type === "topic")     return interaction.showModal(buildModal("modal:" + key, "Set Channel Topic",   input("topic","Topic",         TextInputStyle.Short,     { placeholder: "Enter a new topic...", max: 1024 })));
    if (type === "note")      return interaction.showModal(buildModal("modal:" + key, "Add Note",            input("note","Note",           TextInputStyle.Paragraph, { placeholder: "Write your note...", max: 1000 })));
    if (type === "tag")       return interaction.showModal(buildModal("modal:" + key, "Set Tag Content",     input("content","Content",     TextInputStyle.Paragraph, { placeholder: "Tag content...", max: 2000 })));
    if (type === "remind")    return interaction.showModal(buildModal("modal:" + key, "Set Reminder",        input("time","Time",           TextInputStyle.Short,     { placeholder: "e.g. 10m, 2h, 1d", max: 10 }), input("message","Message",     TextInputStyle.Short,     { placeholder: "What to remind you about...", max: 200 })));
    if (type === "afk")       return interaction.showModal(buildModal("modal:" + key, "Set AFK Reason",      input("reason","Reason",       TextInputStyle.Short,     { placeholder: "Why are you going AFK?", max: 200 })));
    if (type === "warn")      return interaction.showModal(buildModal("modal:" + key, "Warning Reason",      input("reason","Reason",       TextInputStyle.Paragraph, { placeholder: "Why is this user being warned?", max: 500 })));
    return;
  }

  if (id === "poll:yes" || id === "poll:no") {
    const vote = id.split(":")[1];
    const c    = mc(vote === "yes" ? 0x57f287 : 0xed4245);
    c.addTextDisplayComponents(tx("**" + interaction.user.username + "** voted **" + (vote === "yes" ? "✅ Yes" : "❌ No") + "**"));
    return interaction.reply(eph(c));
  }

  if (id.startsWith("tot:")) {
    const [, , label] = id.split(":");
    const c = mc(0xeb459e);
    c.addTextDisplayComponents(tx("**" + interaction.user.username + "** chose **" + label + "**"));
    return interaction.reply(eph(c));
  }
}

async function handleModal(interaction) {
  const id = interaction.customId; if (!id.startsWith("modal:")) return;
  const key = id.slice(6), parts = key.split(":"), type = parts[0];

  if (type === "volume") {
    const vol   = parseInt(interaction.fields.getTextInputValue("volume"));
    if (isNaN(vol) || vol < 1 || vol > 100) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  Volume must be 1–100.")); return interaction.reply(eph(c)); }
    const queue = kazagumo.players.get(interaction.guild.id);
    if (!queue?.current) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  Nothing is playing.")); return interaction.reply(eph(c)); }
    queue.setVolume(vol);
    await interaction.deferUpdate().catch(() => {});
    try { const msg = await interaction.channel.messages.fetch(parts[2]); await msg.edit(buildNowPlaying(queue, queue.currentTrack)); } catch {}
    return;
  }

  const cleanup = async () => { await interaction.deferUpdate().catch(() => {}); await interaction.message.delete().catch(() => {}); };

  if (type === "say") {
    const message = interaction.fields.getTextInputValue("message");
    await cleanup();
    const c = mc(); c.addTextDisplayComponents(tx(message)); return send(interaction.channel, c);
  }
  if (type === "announce") {
    const channelId = parts[2], message = interaction.fields.getTextInputValue("message");
    const target    = interaction.guild.channels.cache.get(channelId);
    if (!target) return interaction.reply({ content: "Channel not found.", ephemeral: true });
    await cleanup();
    const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 📢 Announcement\n" + message + "\n\n-# Posted by " + interaction.user.tag));
    await send(target, c); sendOk(interaction.channel, "## ✅ Announced\nMessage sent to " + target + ".");
    return;
  }
  if (type === "poll") {
    const question = interaction.fields.getTextInputValue("question");
    await cleanup();
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 📊 Poll\n" + question + "\n\n-# Asked by " + interaction.user.username));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("poll:yes").setLabel("✅ Yes").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("poll:no").setLabel("❌ No").setStyle(ButtonStyle.Danger)
    );
    return interaction.channel.send({ components: [c, row], flags: F, allowedMentions: { parse: [] } });
  }
  if (type === "topic") {
    const topicText = interaction.fields.getTextInputValue("topic");
    await cleanup();
    await interaction.channel.setTopic(topicText);
    return sendOk(interaction.channel, "## ✅ Topic Set\n" + topicText);
  }
  if (type === "note") {
    const text = interaction.fields.getTextInputValue("note"), uid = interaction.user.id;
    const list = notes.get(uid) ?? []; list.push({ text, at: Date.now() }); notes.set(uid, list);
    await cleanup(); return sendOk(interaction.channel, "## 📝 Note Saved\n" + text);
  }
  if (type === "tag") {
    const name = parts[2], content = interaction.fields.getTextInputValue("content");
    tags.set(name, { text: content, author: interaction.user.tag });
    await cleanup(); return sendOk(interaction.channel, "## ✅ Tag Saved\n**" + name + "** has been set.");
  }
  if (type === "remind") {
    const timeStr = interaction.fields.getTextInputValue("time"), message = interaction.fields.getTextInputValue("message");
    const ms = parseTime(timeStr);
    if (!ms) { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  Invalid time format. Use s, m, h, or d.")); return interaction.reply(eph(c)); }
    const fireAt = Date.now() + ms, channelId = parts[2];
    reminders.push({ id: interaction.user.id + "-" + fireAt, userId: interaction.user.id, channelId, message, fireAt });
    await cleanup();
    const c = mc(0x57f287); c.addTextDisplayComponents(tx("## ⏰ Reminder Set\n**Message:** " + message + "\n**Fires:** <t:" + Math.floor(fireAt/1000) + ":R>\n**Duration:** " + fmtDur(ms)));
    return send(interaction.channel, c);
  }
  if (type === "afk") {
    const reason = interaction.fields.getTextInputValue("reason");
    afkStore.set(interaction.user.id, { reason, since: Date.now() });
    await cleanup();
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## 💤 AFK Set\n**Reason:** " + reason)); return send(interaction.channel, c);
  }
  if (type === "warn") {
    const targetId = parts[2], guildId = parts[3], reason = interaction.fields.getTextInputValue("reason");
    const guild    = client.guilds.cache.get(guildId), target = guild?.members.cache.get(targetId);
    if (!target) return interaction.reply({ content: "User not found.", ephemeral: true });
    const dmC = mc(0xfee75c); dmC.addTextDisplayComponents(tx("## ⚠️ Warning from **" + guild.name + "**\n**Reason:** " + reason));
    await target.send({ components: [dmC], flags: F }).catch(() => {});
    await cleanup();
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## ⚠️ Warned\n**User:** " + target.user.tag + "\n**Reason:** " + reason + "\n**Mod:** " + interaction.user.tag));
    return send(interaction.channel, c);
  }
}

async function handleSelect(interaction) {
  if (interaction.customId !== "help:cat") return;
  const cat   = CATEGORIES.find(c => c.name === interaction.values[0]);
  if (!cat) return interaction.deferUpdate();
  const total = CATEGORIES.reduce((t, c) => t + c.list.length, 0);
  const c = mc(0x5865f2);
  c.addTextDisplayComponents(tx("## " + cat.icon + "  " + cat.name + " — " + cat.list.length + " commands\n-# Prefix: " + PREFIX + "  ·  " + total + " total  ·  " + PREFIX + "help <command> for details"));
  c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(cat.list.map(cmd => cmdLine(cmd)).join("\n")));
  const select = new StringSelectMenuBuilder().setCustomId("help:cat").setPlaceholder("Browse a category...")
    .addOptions(CATEGORIES.filter(c => c.list.length).map(c =>
      new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.name).setDescription(c.list.length + " commands").setEmoji(c.icon).setDefault(c.name === cat.name)
    ));
  return interaction.update({ components: [c, new ActionRowBuilder().addComponents(select)], flags: F, allowedMentions: { parse: [] } });
}


client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.mentions.users.size) {
    for (const [id, data] of afkStore) {
      if (msg.mentions.users.has(id) && id !== msg.author.id) {
        const c = mc(0xfee75c); c.addTextDisplayComponents(tx("💤 **<@" + id + ">** is AFK — " + data.reason + " (" + fmtDur(Date.now() - data.since) + " ago)"));
        send(msg.channel, c);
      }
    }
  }

  if (afkStore.has(msg.author.id) && !msg.content.startsWith(PREFIX)) {
    const since = fmtDur(Date.now() - afkStore.get(msg.author.id).since);
    afkStore.delete(msg.author.id);
    const c = mc(0x57f287); c.addTextDisplayComponents(tx("👋 Welcome back, **" + msg.author.username + "**! AFK for " + since + "."));
    const m = await send(msg.channel, c); setTimeout(() => m.delete().catch(() => {}), 6000);
  }

  if (!msg.content.startsWith(PREFIX)) return;

  const args    = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const invoked = args.shift().toLowerCase();
  const command = registry.get(invoked);
  if (!command) return;

  if (!whitelist.has(msg.author.id)) return;

  const wait = cooldown(msg.author.id, command.name, 2);
  if (wait > 0) {
    const c = mc(0xfee75c); c.addTextDisplayComponents(tx("⏳ Wait **" + wait + "s** before using " + PREFIX + command.name + " again."));
    const m = await send(msg.channel, c); setTimeout(() => m.delete().catch(() => {}), 4000); return;
  }

  try { await command.run(msg, args, invoked); }
  catch (e) { console.error("[ERROR] " + PREFIX + invoked + ":", e); sendErr(msg.channel, "An unexpected error occurred."); }
});

client.on("messageDelete", (msg) => {
  if (msg.author?.bot || !msg.content) return;
  snipeStore.set(msg.channel.id, { content: msg.content, author: msg.author?.tag ?? "Unknown", at: Date.now() });
});

client.on("messageUpdate", (before, after) => {
  if (before.author?.bot || before.content === after.content) return;
  esnipeStore.set(before.channel.id, { before: before.content, after: after.content, author: before.author?.tag ?? "Unknown", at: Date.now() });
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton())             await handleButton(interaction);
    else if (interaction.isModalSubmit())   await handleModal(interaction);
    else if (interaction.isStringSelectMenu()) await handleSelect(interaction);
  } catch (e) {
    console.error("[INTERACTION]", e);
    const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  An error occurred."));
    if (!interaction.replied && !interaction.deferred) await interaction.reply(eph(c)).catch(() => {});
  }
});

setInterval(async () => {
  const now = Date.now();
  for (let i = reminders.length - 1; i >= 0; i--) {
    const r = reminders[i];
    if (now >= r.fireAt) {
      reminders.splice(i, 1);
      try {
        const ch = await client.channels.fetch(r.channelId);
        const c  = mc(0x57f287); c.addTextDisplayComponents(tx("## ⏰ Reminder!\n<@" + r.userId + "> — " + r.message));
        ch.send({ content: "<@" + r.userId + ">", components: [c], flags: F });
      } catch (e) { console.error("[REMINDER]", e); }
    }
  }
}, 5000);

client.once("ready", () => {
  const total = CATEGORIES.reduce((t, cat) => t + cat.list.length, 0);
  console.log("✅  " + client.user.tag + "  |  prefix: " + PREFIX + "  |  commands: " + total);
  client.user.setPresence({ status: "online", activities: [{ name: "Vibing to your favorite tracks.", type: ActivityType.Custom }] });
});

const server = http.createServer((req, res) => { res.writeHead(200); res.end("OK"); });
server.listen(3000, () => console.log("Keep-alive on port 3000"));

client.login(TOKEN);
