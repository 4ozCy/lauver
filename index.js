require("dotenv").config();

const {
  Client, GatewayIntentBits, Partials, Collection,
  MessageFlags, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActivityType, PermissionFlagsBits,
  REST, Routes, SlashCommandBuilder,
} = require("discord.js");

const https = require("https");
const http  = require("http");
const { Kazagumo } = require("kazagumo");
const { Connectors } = require("shoukaku");

const TOKEN = process.env.TOKEN;
const PREFIX = ".";
const OWNER = "1107744228773220473";

if (!TOKEN){ console.error("Missing TOKEN");process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

const LAVA_NODES = [{ url: "lava-v4.ajieblogs.eu.org:443", auth: "https://dsc.gg/ajidevserver", secure: true }];

const kazagumo = new Kazagumo({
  defaultSearchEngine: "youtube",
  send: (guildId, payload) => { const g = client.guilds.cache.get(guildId); if (g) g.shard.send(payload); },
}, new Connectors.DiscordJS(client), LAVA_NODES);

kazagumo.shoukaku.on("error", (name, err) => console.error("[LAVALINK]", name, err.message));

const cooldowns      = new Collection();
const afkStore       = new Collection();
const snipeStore     = new Collection();
const esnipeStore    = new Collection();
const reminders      = [];
const notes          = new Collection();
const tags           = new Collection();
const pendingConfirm = new Collection();
const pageStore      = new Collection();

const F   = MessageFlags.IsComponentsV2;
const mc  = (color = 0x5865f2) => new ContainerBuilder().setAccentColor(color);
const tx  = (s) => new TextDisplayBuilder().setContent(s);
const sp  = () => new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
const send    = (ch, c, extra = []) => ch.send({ components: [c, ...extra], flags: F, allowedMentions: { parse: [] } });
const sendErr = (ch, m) => { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  " + m)); return send(ch, c); };
const sendOk  = (ch, m) => { const c = mc(0x57f287); c.addTextDisplayComponents(tx(m)); return send(ch, c); };
const eph     = (c) => ({ components: [c], flags: F | MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
const ephErr  = (m) => { const c = mc(0xed4245); c.addTextDisplayComponents(tx("❌  " + m)); return eph(c); };
const ephOk   = (m) => { const c = mc(0x57f287); c.addTextDisplayComponents(tx(m)); return eph(c); };

const hasPerm = (m, ...f) => f.every(p => m.permissions.has(p));

const cooldown = (uid, name, secs = 2) => {
  const key = uid + ":" + name, now = Date.now();
  if (cooldowns.has(key)) { const exp = cooldowns.get(key); if (now < exp) return Math.ceil((exp - now) / 1000); }
  cooldowns.set(key, now + secs * 1000);
  return 0;
};

const fmtDur = (ms) => {
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d) return d+"d "+(h%24)+"h "+(m%60)+"m";
  if (h) return h+"h "+(m%60)+"m "+(s%60)+"s";
  if (m) return m+"m "+(s%60)+"s";
  return s+"s";
};

const parseTime = (s) => {
  const m = s?.match(/^(\d+)(s|m|h|d)$/i); if (!m) return null;
  return parseInt(m[1]) * { s:1e3, m:6e4, h:36e5, d:864e5 }[m[2].toLowerCase()];
};

const fetchJSON = (url) => new Promise((resolve, reject) => {
  const mod = url.startsWith("https") ? https : http;
  mod.get(url, { headers: { "User-Agent": "UtilityBot/1.0" } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
      return fetchJSON(res.headers.location).then(resolve).catch(reject);
    let d = ""; res.on("data", c => d += c);
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
const ZODIAC = { aries:{dates:"Mar 21–Apr 19",symbol:"♈",trait:"Bold, ambitious, passionate"},taurus:{dates:"Apr 20–May 20",symbol:"♉",trait:"Reliable, patient, devoted"},gemini:{dates:"May 21–Jun 20",symbol:"♊",trait:"Curious, adaptable, witty"},cancer:{dates:"Jun 21–Jul 22",symbol:"♋",trait:"Intuitive, sentimental, loyal"},leo:{dates:"Jul 23–Aug 22",symbol:"♌",trait:"Creative, generous, warm-hearted"},virgo:{dates:"Aug 23–Sep 22",symbol:"♍",trait:"Analytical, practical, hardworking"},libra:{dates:"Sep 23–Oct 22",symbol:"♎",trait:"Diplomatic, gracious, fair-minded"},scorpio:{dates:"Oct 23–Nov 21",symbol:"♏",trait:"Resourceful, brave, passionate"},sagittarius:{dates:"Nov 22–Dec 21",symbol:"♐",trait:"Generous, idealistic, adventurous"},capricorn:{dates:"Dec 22–Jan 19",symbol:"♑",trait:"Responsible, disciplined, self-controlled"},aquarius:{dates:"Jan 20–Feb 18",symbol:"♒",trait:"Progressive, independent, humanitarian"},pisces:{dates:"Feb 19–Mar 20",symbol:"♓",trait:"Compassionate, artistic, intuitive"} };

function buildModal(id, title, ...inputs) {
  const m = new ModalBuilder().setCustomId(id).setTitle(title);
  m.addComponents(inputs.map(i => new ActionRowBuilder().addComponents(i))); return m;
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
    new ButtonBuilder().setCustomId("confirm:"+key).setLabel("Confirm").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("cancel:"+key).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
  );
}
function modalBtn(id, label) {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Primary));
}
async function confirm(msg, desc, fn) {
  const key = msg.author.id+":"+Date.now();
  pendingConfirm.set(key, { fn, uid: msg.author.id });
  setTimeout(() => pendingConfirm.delete(key), 30000);
  const c = mc(0xfee75c); c.addTextDisplayComponents(tx("## ⚠️ Confirm\n"+desc+"\n\n-# Expires in 30 seconds."));
  return msg.channel.send({ components: [c, confirmRow(key)], flags: F, allowedMentions: { parse: [] } });
}
async function paginate(channel, uid, items, perPage, rowFn, title, color = 0x5865f2) {
  if (!items.length) return sendErr(channel, "No items to display.");
  const id = "pg:"+uid+":"+Date.now(), total = Math.ceil(items.length / perPage);
  pageStore.set(id, { items, perPage, rowFn, title, color, total });
  setTimeout(() => pageStore.delete(id), 120000);
  return renderPage(channel, id, 0);
}
async function renderPage(channel, id, page, editMsg = null) {
  const p = pageStore.get(id); if (!p) return;
  const slice = p.items.slice(page * p.perPage, (page+1) * p.perPage);
  const c = mc(p.color);
  c.addTextDisplayComponents(tx("## "+p.title+"\n-# Page "+(page+1)+" of "+p.total+"  ·  "+p.items.length+" total"));
  c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx(slice.map(p.rowFn).join("\n")));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("pg:prev:"+id+":"+page).setLabel("← Prev").setStyle(ButtonStyle.Secondary).setDisabled(page===0),
    new ButtonBuilder().setCustomId("pg:next:"+id+":"+page).setLabel("Next →").setStyle(ButtonStyle.Secondary).setDisabled(page>=p.total-1)
  );
  if (editMsg) return editMsg.edit({ components: [c, row], flags: F, allowedMentions: { parse: [] } });
  return channel.send({ components: [c, row], flags: F, allowedMentions: { parse: [] } });
}

function msToTime(ms) {
  if (!ms) return "0:00";
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
  if (h) return h+":"+String(m%60).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  return m+":"+String(s%60).padStart(2,"0");
}
function buildNowPlaying(player, track) {
  const loopLabels = { none:"🔄 Off", track:"🔂 Track", queue:"🔁 Queue" };
  const paused = player.paused;
  const c = mc(0x1db954);
  c.addTextDisplayComponents(tx(
    "## 🎵 Now Playing\n**"+track.title+"**\n"+(track.author?track.author+"  ·  ":"")+msToTime(track.length)+
    "\n\n-# 👤 "+(track.requester?.username??"Unknown")+"  ·  📋 "+player.queue.length+" in queue"+
    "  ·  "+(loopLabels[player.loop]??"🔄 Off")+"  ·  🔊 "+player.volume+"%"
  ));
  c.addSeparatorComponents(sp());
  c.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music:playpause").setLabel(paused?"▶  Resume":"⏸  Pause").setStyle(paused?ButtonStyle.Success:ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music:skip").setLabel("⏭  Skip").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:stop").setLabel("⏹  Stop").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music:shuffle").setLabel("🔀  Shuffle").setStyle(ButtonStyle.Secondary),
  ));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music:loop").setLabel("🔁  Loop").setStyle(player.loop==="none"?ButtonStyle.Secondary:ButtonStyle.Success),
    new ButtonBuilder().setCustomId("music:voldown").setLabel("🔉 -10").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:volup").setLabel("🔊 +10").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music:clearqueue").setLabel("🗑  Clear Queue").setStyle(ButtonStyle.Secondary),
  ));
  return { components: [c], flags: F, allowedMentions: { parse: [] } };
}
async function refreshNP(player) {
  const track = player.queue?.current; if (!track) return;
  const msg = player.data.get("npMessage"); if (!msg) return;
  try { await msg.edit(buildNowPlaying(player, track)); } catch { player.data.delete("npMessage"); }
}

kazagumo.on("playerStart", async (player, track) => {
  const channel = player.data.get("channel"); if (!channel) return;
  const data = buildNowPlaying(player, track);
  const old  = player.data.get("npMessage");
  if (old) { try { await old.edit(data); return; } catch {} }
  const msg = await channel.send(data);
  player.data.set("npMessage", msg);
});
kazagumo.on("playerEmpty", (player) => {
  const old = player.data.get("npMessage");
  if (old) { old.delete().catch(() => {}); player.data.delete("npMessage"); }
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 🎵 Queue Ended\nNo more tracks."));
  player.data.get("channel")?.send({ components: [c], flags: F, allowedMentions: { parse: [] } });
});
kazagumo.on("playerClosed", (player) => {
  const old = player.data.get("npMessage");
  if (old) { old.delete().catch(() => {}); player.data.delete("npMessage"); }
  const c = mc(0x5865f2); c.addTextDisplayComponents(tx("## 🔌 Player disconnected."));
  player.data.get("channel")?.send({ components: [c], flags: F, allowedMentions: { parse: [] } });
});
kazagumo.on("playerException", (p, t, payload) => console.error("[PLAYER EXCEPTION]", payload));
kazagumo.on("playerError",     (p, t)          => console.error("[PLAYER ERROR]", t));

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

function reg(cat, name, aliases, desc, usage, slashOrRun, maybeRun) {
  let slashFn = null, run;
  if (typeof maybeRun === "function") { slashFn = slashOrRun; run = maybeRun; }
  else { run = slashOrRun; }
  const def = { name, aliases, desc, usage, slashFn, run };
  registry.set(name, def);
  for (const a of aliases) registry.set(a, def);
  CATEGORIES.find(c => c.name === cat)?.list.push(def);
}

const cmdLine = (cmd) => "**"+PREFIX+cmd.name+"**"+(cmd.aliases.length?" *("+cmd.aliases.join(", ")+")*":"")+" — "+cmd.desc;

async function dispatchSlash(interaction) {
  const def = registry.get(interaction.commandName); if (!def) return;
  await interaction.deferReply({ ephemeral: false }).catch(() => {});

  const args = (interaction.options?.data ?? []).map(o => String(o.value ?? ""));

  const shim = {
    guild:   interaction.guild,
    member:  interaction.member,
    author:  interaction.user,
    mentions: {
      users:    { first: () => interaction.options.getUser?.("user") ?? interaction.options.getUser?.("target") ?? null, has: () => false },
      members:  { first: () => interaction.options.getMember?.("user") ?? interaction.options.getMember?.("target") ?? null },
      roles:    { first: () => interaction.options.getRole?.("role") ?? null },
      channels: { first: () => interaction.options.getChannel?.("channel") ?? null },
    },
    channel: new Proxy(interaction.channel, {
      get(target, prop) {
        if (prop === "send") return async (payload) => interaction.editReply(payload).catch(() => interaction.channel.send(payload));
        return typeof target[prop] === "function" ? target[prop].bind(target) : target[prop];
      }
    }),
    _interaction: interaction,
  };

  const _origSend    = send;
  const _origSendErr = sendErr;
  const _origSendOk  = sendOk;

  const slashSend    = (ch, c, extra=[]) => interaction.editReply({ components:[c,...extra], flags:F, allowedMentions:{parse:[]} }).catch(() => {});
  const slashSendErr = (ch, m) => { const c=mc(0xed4245); c.addTextDisplayComponents(tx("❌  "+m)); return interaction.editReply(eph(c)).catch(() => {}); };
  const slashSendOk  = (ch, m) => { const c=mc(0x57f287); c.addTextDisplayComponents(tx(m)); return interaction.editReply({ components:[c], flags:F, allowedMentions:{parse:[]} }).catch(() => {}); };

  global._slashSend    = slashSend;
  global._slashSendErr = slashSendErr;
  global._slashSendOk  = slashSendOk;
  global._isSlash      = true;

  try { await def.run(shim, args, interaction.commandName); }
  catch(e) { console.error("[SLASH:"+interaction.commandName+"]", e); interaction.editReply({ content: "An error occurred.", ephemeral: true }).catch(() => {}); }
  finally { global._isSlash = false; }
}

const _send    = (ch, c, extra=[]) => global._isSlash ? global._slashSend(ch,c,extra) : ch.send({ components:[c,...extra], flags:F, allowedMentions:{parse:[]} });
const _sendErr = (ch, m) => global._isSlash ? global._slashSendErr(ch,m) : sendErr(ch,m);
const _sendOk  = (ch, m) => global._isSlash ? global._slashSendOk(ch,m)  : sendOk(ch,m);

function buildHelpCat(cat) {
  const c = mc(0x5865f2);
  c.addTextDisplayComponents(tx(cat.icon+"  **"+cat.name+"** — "+cat.list.length+" commands"));
  c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(cat.list.map(cmd => cmdLine(cmd)).join("\n")));
  const select = new StringSelectMenuBuilder().setCustomId("help:cat").setPlaceholder("Browse a category...")
    .addOptions(CATEGORIES.filter(cat => cat.list.length).map(cat => new StringSelectMenuOptionBuilder().setLabel(cat.name).setValue(cat.name).setDescription(cat.list.length+" commands").setEmoji(cat.icon)));
  return { container: c, row: new ActionRowBuilder().addComponents(select) };
}
function sendHelpCat(channel, cat) {
  const { container, row } = buildHelpCat(cat);
  return channel.send({ components: [container, row], flags: F, allowedMentions: { parse: [] } });
}

reg("General","ping",["latency","ms"],"Check bot latency",".ping", async (msg) => {
  const c = mc(); c.addTextDisplayComponents(tx("## 📡 Pong!\n**Websocket:** "+client.ws.ping+"ms"));
  _send(msg.channel, c);
});

reg("General","botinfo",["bot","bi","about"],"Bot stats and uptime",".botinfo", async (msg) => {
  const u=process.uptime(),h=Math.floor(u/3600),m=Math.floor((u%3600)/60),s=Math.floor(u%60);
  const c=mc(); c.addTextDisplayComponents(tx("## 🤖 Bot Info")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Name:** "+client.user.tag+"\n**ID:** "+client.user.id+"\n**Prefix:** "+PREFIX+"\n**Uptime:** "+h+"h "+m+"m "+s+"s\n**Servers:** "+client.guilds.cache.size+"\n**Node.js:** "+process.version));
  _send(msg.channel, c);
});

reg("General","serverinfo",["si","guild","server"],"Info about this server",".serverinfo", async (msg) => {
  const g=msg.guild; if(!g) return;
  const owner=await g.fetchOwner();
  const tCh=g.channels.cache.filter(c=>c.type===0).size, vCh=g.channels.cache.filter(c=>c.type===2).size;
  const c=mc(); c.addTextDisplayComponents(tx("## 🏠 "+g.name)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Owner:** "+owner.user.tag+"\n**ID:** "+g.id+"\n**Members:** "+g.memberCount+"\n**Roles:** "+g.roles.cache.size+"\n**Channels:** "+tCh+" text  ·  "+vCh+" voice\n**Boosts:** "+g.premiumSubscriptionCount+" (Level "+g.premiumTier+")\n**Created:** <t:"+Math.floor(g.createdTimestamp/1000)+":R>"));
  _send(msg.channel, c);
});

reg("General","userinfo",["ui","whois","who"],"User profile info",".userinfo [@user]",
  cmd=>cmd.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(false)),
  async (msg,args) => {
    const target = msg.mentions?.users?.first() ?? (msg._interaction?.options?.getUser("user")) ?? msg.author;
    const member = msg.guild?.members.cache.get(target.id);
    const roles  = member?.roles.cache.filter(r=>r.id!==msg.guild.id).map(r=>r.toString()).join(" ")||"None";
    const c=mc(); c.addTextDisplayComponents(tx("## 👤 "+target.tag)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**ID:** "+target.id+"\n**Created:** <t:"+Math.floor(target.createdTimestamp/1000)+":R>\n"+(member?"**Joined:** <t:"+Math.floor(member.joinedTimestamp/1000)+":R>\n":"")+"**Bot:** "+(target.bot?"Yes":"No")+"\n"+(member?"**Roles ["+( member.roles.cache.size-1)+"]:** "+roles:"")));
    _send(msg.channel, c);
  });

reg("General","avatar",["av","pfp","pic"],"Get a user's avatar",".avatar [@user]",
  cmd=>cmd.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(false)),
  async (msg) => {
    const target = msg.mentions?.users?.first() ?? (msg._interaction?.options?.getUser("user")) ?? msg.author;
    const url=target.displayAvatarURL({size:512,extension:"png"});
    const c=mc(); c.addTextDisplayComponents(tx("## 🖼️ "+target.username+"'s Avatar")); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("[Open full size]("+url+")\n"+url)); _send(msg.channel, c);
  });

reg("General","banner",["userbanner"],"Get a user's banner",".banner [@user]",
  cmd=>cmd.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(false)),
  async (msg) => {
    const target=msg.mentions?.users?.first()??(msg._interaction?.options?.getUser("user"))??msg.author;
    const user=await client.users.fetch(target.id,{force:true}), url=user.bannerURL({size:1024});
    const c=mc();
    if(!url){c.addTextDisplayComponents(tx("❌  "+target.username+" has no banner."));}
    else{c.addTextDisplayComponents(tx("## 🎨 "+target.username+"'s Banner"));c.addSeparatorComponents(sp());c.addTextDisplayComponents(tx("[Open full size]("+url+")\n"+url));}
    _send(msg.channel, c);
  });

reg("General","membercount",["members","count"],"Member count breakdown",".membercount", async (msg) => {
  if(!msg.guild) return;
  const bots=msg.guild.members.cache.filter(m=>m.user.bot).size;
  const c=mc(); c.addTextDisplayComponents(tx("## 👥 "+msg.guild.name+"\n**Total:** "+msg.guild.memberCount+"\n**Humans:** "+(msg.guild.memberCount-bots)+"\n**Bots:** "+bots));
  _send(msg.channel, c);
});

reg("General","roleinfo",["ri"],"Info about a role",".roleinfo @role",
  cmd=>cmd.addRoleOption(o=>o.setName("role").setDescription("Target role").setRequired(true)),
  async (msg) => {
    const role=msg.mentions?.roles?.first()??(msg._interaction?.options?.getRole("role"));
    if(!role) return _sendErr(msg.channel,"Usage: "+PREFIX+"roleinfo @role");
    const c=mc(role.color||0x5865f2); c.addTextDisplayComponents(tx("## 🎭 "+role.name)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**ID:** "+role.id+"\n**Color:** "+role.hexColor+"\n**Members:** "+role.members.size+"\n**Position:** "+role.position+"\n**Mentionable:** "+(role.mentionable?"Yes":"No")+"\n**Hoisted:** "+(role.hoist?"Yes":"No")+"\n**Created:** <t:"+Math.floor(role.createdTimestamp/1000)+":R>"));
    _send(msg.channel, c);
  });

reg("General","channelinfo",["ci"],"Info about a channel",".channelinfo [#channel]",
  cmd=>cmd.addChannelOption(o=>o.setName("channel").setDescription("Target channel").setRequired(false)),
  async (msg) => {
    const ch=msg.mentions?.channels?.first()??(msg._interaction?.options?.getChannel("channel"))??msg.channel;
    const c=mc(); c.addTextDisplayComponents(tx("## 📺 #"+ch.name)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**ID:** "+ch.id+"\n**Type:** "+ch.type+"\n"+(ch.topic?"**Topic:** "+ch.topic+"\n":"")+(ch.rateLimitPerUser?"**Slowmode:** "+ch.rateLimitPerUser+"s\n":"")+"**NSFW:** "+(ch.nsfw?"Yes":"No")+"\n**Created:** <t:"+Math.floor(ch.createdTimestamp/1000)+":R>"));
    _send(msg.channel, c);
  });

reg("General","invite",["inv","link"],"Generate a server invite",".invite", async (msg) => {
  if(!msg.guild) return;
  const inv=await msg.channel.createInvite({maxAge:86400,maxUses:0});
  const c=mc(); c.addTextDisplayComponents(tx("## 🔗 Invite\nhttps://discord.gg/"+inv.code+"\n\n-# Expires in 24 hours"));
  _send(msg.channel, c);
});

reg("General","inrole",["ir"],"List members with a role",".inrole @role",
  cmd=>cmd.addRoleOption(o=>o.setName("role").setDescription("Target role").setRequired(true)),
  async (msg) => {
    const role=msg.mentions?.roles?.first()??(msg._interaction?.options?.getRole("role"));
    if(!role) return _sendErr(msg.channel,"Usage: "+PREFIX+"inrole @role");
    const members=[...role.members.values()]; if(!members.length) return _sendErr(msg.channel,"No members have this role.");
    paginate(msg.channel, msg.author.id, members, 15, m=>m.user.tag, "Members in "+role.name, role.color||0x5865f2);
  });

reg("General","boosts",["boosters"],"Show server boosters",".boosts", async (msg) => {
  if(!msg.guild) return;
  const boosters=[...msg.guild.members.cache.filter(m=>m.premiumSince).values()];
  if(!boosters.length) return _sendErr(msg.channel,"No boosters.");
  paginate(msg.channel, msg.author.id, boosters, 15, m=>m.user.tag+" — <t:"+Math.floor(m.premiumSinceTimestamp/1000)+":R>", "🌸 Boosters", 0xf47fff);
});

reg("General","emojis",["emoji","em"],"List server emojis",".emojis", async (msg) => {
  if(!msg.guild) return;
  const emojis=[...msg.guild.emojis.cache.values()]; if(!emojis.length) return _sendErr(msg.channel,"No emojis.");
  paginate(msg.channel, msg.author.id, emojis, 20, e=>e+" "+e.name, "😄 Emojis ("+emojis.length+")");
});

reg("General","oldest",["veterans","og"],"Show the oldest members",".oldest", async (msg) => {
  if(!msg.guild) return; await msg.guild.members.fetch();
  const sorted=[...msg.guild.members.cache.filter(m=>!m.user.bot).values()].sort((a,b)=>a.joinedTimestamp-b.joinedTimestamp);
  paginate(msg.channel, msg.author.id, sorted, 10, (m,i)=>(i+1)+".  "+m.user.tag+" — <t:"+Math.floor(m.joinedTimestamp/1000)+":R>", "🏛️ Oldest Members");
});

reg("General","newmembers",["new","newest"],"Show the newest members",".newmembers", async (msg) => {
  if(!msg.guild) return; await msg.guild.members.fetch();
  const sorted=[...msg.guild.members.cache.filter(m=>!m.user.bot).values()].sort((a,b)=>b.joinedTimestamp-a.joinedTimestamp);
  paginate(msg.channel, msg.author.id, sorted, 10, (m,i)=>(i+1)+".  "+m.user.tag+" — <t:"+Math.floor(m.joinedTimestamp/1000)+":R>", "🆕 Newest Members");
});

reg("General","servericon",["gicon","sicon"],"Get the server icon",".servericon", async (msg) => {
  if(!msg.guild) return;
  const url=msg.guild.iconURL({size:512,extension:"png"}); if(!url) return _sendErr(msg.channel,"This server has no icon.");
  const c=mc(); c.addTextDisplayComponents(tx("## 🖼️ "+msg.guild.name+" Icon")); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx("[Open full size]("+url+")\n"+url)); _send(msg.channel, c);
});

reg("General","serverbanner",["sbanner"],"Get the server banner",".serverbanner", async (msg) => {
  if(!msg.guild) return;
  const url=msg.guild.bannerURL({size:1024}); if(!url) return _sendErr(msg.channel,"This server has no banner.");
  const c=mc(); c.addTextDisplayComponents(tx("## 🎨 "+msg.guild.name+" Banner")); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx("[Open full size]("+url+")\n"+url)); _send(msg.channel, c);
});

reg("General","permissions",["perms","perm"],"List a user's permissions",".permissions [@user]",
  cmd=>cmd.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(false)),
  async (msg) => {
    const target=msg.mentions?.members?.first()??(msg._interaction?.options?.getMember("user"))??msg.member;
    const perms=msg.channel.permissionsFor(target); if(!perms) return _sendErr(msg.channel,"Could not fetch permissions.");
    const allowed=Object.entries(PermissionFlagsBits).filter(([,bit])=>perms.has(bit)).map(([n])=>n.replace(/([A-Z])/g," $1").trim()).slice(0,20);
    const c=mc(); c.addTextDisplayComponents(tx("## 🔐 Permissions — "+target.user.username)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx(allowed.join("\n")||"No permissions.")); _send(msg.channel, c);
  });

reg("General","joinpos",["jp","joinrank"],"Show member join position",".joinpos [@user]",
  cmd=>cmd.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(false)),
  async (msg) => {
    if(!msg.guild) return; await msg.guild.members.fetch();
    const target=msg.mentions?.members?.first()??(msg._interaction?.options?.getMember("user"))??msg.member;
    const sorted=[...msg.guild.members.cache.values()].sort((a,b)=>a.joinedTimestamp-b.joinedTimestamp);
    const pos=sorted.findIndex(m=>m.id===target.id)+1;
    const c=mc(); c.addTextDisplayComponents(tx("## 📊 Join Position\n**"+target.user.tag+"** joined as member **#"+pos+"** out of "+msg.guild.memberCount+".")); _send(msg.channel, c);
  });

reg("General","presence",["activity","doing"],"See what a user is doing",".presence [@user]",
  cmd=>cmd.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(false)),
  async (msg) => {
    const target=msg.mentions?.members?.first()??(msg._interaction?.options?.getMember("user"))??msg.member;
    const pres=target.presence;
    if(!pres||!pres.activities.length) return _sendErr(msg.channel,"**"+target.user.username+"** has no visible activity.");
    const typeMap={0:"Playing",1:"Streaming",2:"Listening to",3:"Watching",4:"Custom",5:"Competing in"};
    const lines=pres.activities.map(a=>(typeMap[a.type]??"Doing")+" **"+a.name+"**"+(a.details?"\n  ↳ "+a.details:"")+(a.state?"\n  ↳ "+a.state:"")).join("\n");
    const c=mc(); c.addTextDisplayComponents(tx("## 🟢 "+target.user.username+"'s Activity")); c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx(lines)); _send(msg.channel, c);
  });

reg("General","created",["age","accountage"],"Show when an account was created",".created [@user]",
  cmd=>cmd.addUserOption(o=>o.setName("user").setDescription("Target user").setRequired(false)),
  async (msg) => {
    const target=msg.mentions?.users?.first()??(msg._interaction?.options?.getUser("user"))??msg.author;
    const c=mc(); c.addTextDisplayComponents(tx("## 📅 Account Age — "+target.username+"\n**Created:** <t:"+Math.floor(target.createdTimestamp/1000)+":F>\n**Age:** "+fmtDur(Date.now()-target.createdTimestamp)+" ago")); _send(msg.channel, c);
  });

reg("General","lookup",["fetchuser","getuser"],"Fetch any user by ID",".lookup <userID>",
  cmd=>cmd.addStringOption(o=>o.setName("id").setDescription("User ID to look up").setRequired(true)),
  async (msg,args) => {
    const id=msg._interaction?.options?.getString("id")||args[0]; if(!id) return _sendErr(msg.channel,"Usage: "+PREFIX+"lookup <userID>");
    let user; try{user=await client.users.fetch(id,{force:true});}catch{return _sendErr(msg.channel,"User not found.");}
    const c=mc(); c.addTextDisplayComponents(tx("## 👤 "+user.tag)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**ID:** "+user.id+"\n**Created:** <t:"+Math.floor(user.createdTimestamp/1000)+":R>\n**Bot:** "+(user.bot?"Yes":"No"))); _send(msg.channel, c);
  });

reg("General","uptime",["ut","up"],"Show bot uptime",".uptime", async (msg) => {
  const c=mc(); c.addTextDisplayComponents(tx("## ⏱️ Uptime\n"+fmtDur(process.uptime()*1000))); _send(msg.channel, c);
});

reg("General","snowflake",["sf","parseid"],"Parse a Discord snowflake ID",".snowflake <id>",
  cmd=>cmd.addStringOption(o=>o.setName("id").setDescription("Snowflake ID").setRequired(true)),
  async (msg,args) => {
    const id=msg._interaction?.options?.getString("id")||args[0];
    if(!id||isNaN(id)) return _sendErr(msg.channel,"Usage: "+PREFIX+"snowflake <id>");
    const ts=Math.floor(Number(BigInt(id)>>22n)+1420070400000);
    const c=mc(); c.addTextDisplayComponents(tx("## ❄️ Snowflake — "+id)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**Created:** <t:"+Math.floor(ts/1000)+":F>\n**Timestamp:** "+ts+"ms")); _send(msg.channel, c);
  });

reg("General","serverroles",["sr","listroles","roles"],"List all server roles",".serverroles", async (msg) => {
  if(!msg.guild) return;
  const roles=[...msg.guild.roles.cache.filter(r=>r.id!==msg.guild.id).values()].sort((a,b)=>b.position-a.position);
  paginate(msg.channel, msg.author.id, roles, 15, r=>"**"+r.name+"** — "+r.members.size+" members", "🎭 Roles ("+roles.length+")");
});

reg("General","commandstats",["cs","cmdstats"],"Show command count",".commandstats", async (msg) => {
  const total=CATEGORIES.reduce((t,cat)=>t+cat.list.length,0), aliases=registry.size-total;
  const c=mc(); c.addTextDisplayComponents(tx("## 📊 Command Stats")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Total Commands:** "+total+"\n**Total Aliases:** "+aliases+"\n\n"+CATEGORIES.filter(cat=>cat.list.length).map(cat=>cat.icon+" **"+cat.name+":** "+cat.list.length).join("\n"))); _send(msg.channel, c);
});

reg("General","help",["h","commands","cmds"],"List commands or get details on one",".help [command]",
  cmd=>cmd.addStringOption(o=>o.setName("command").setDescription("Command or category name").setRequired(false)),
  async (msg,args) => {
    const query=msg._interaction?.options?.getString("command")||args[0];
    if(query){
      const found=registry.get(query.toLowerCase());
      if(found){
        const cat=CATEGORIES.find(c=>c.list.includes(found));
        const c=mc(0x5865f2); c.addTextDisplayComponents(tx("## "+PREFIX+found.name+"\n-# "+(cat?cat.icon+"  "+cat.name:"General"))); c.addSeparatorComponents(sp());
        c.addTextDisplayComponents(tx("**Description**\n"+found.desc+"\n\n**Usage**\n"+found.usage+(found.aliases.length?"\n\n**Aliases**\n"+found.aliases.map(a=>PREFIX+a).join("  ·  "):"")));
        return _send(msg.channel,c);
      }
      const matchedCat=CATEGORIES.find(cat=>cat.name.toLowerCase()===query.toLowerCase());
      if(matchedCat) return sendHelpCat(msg.channel, matchedCat);
      return _sendErr(msg.channel,"Unknown command: "+query);
    }
    const total=CATEGORIES.reduce((t,cat)=>t+cat.list.length,0);
    const c=mc(0x5865f2);
    c.addTextDisplayComponents(tx("## 📋 Command List\n-# Prefix: **"+PREFIX+"**  ·  "+total+" commands  ·  Also available as /slash commands"));
    c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx(CATEGORIES.filter(cat=>cat.list.length).map(cat=>cat.icon+"  **"+cat.name+"** — "+cat.list.length+" commands").join("\n")));
    const select=new StringSelectMenuBuilder().setCustomId("help:cat").setPlaceholder("Browse a category...")
      .addOptions(CATEGORIES.filter(cat=>cat.list.length).map(cat=>new StringSelectMenuOptionBuilder().setLabel(cat.name).setValue(cat.name).setDescription(cat.list.length+" commands").setEmoji(cat.icon)));
    msg.channel.send({ components:[c,new ActionRowBuilder().addComponents(select)], flags:F, allowedMentions:{parse:[]} });
  });

reg("Music","play",["p","add"],"Play a song or add it to the queue",".play <song or URL>", async (msg,args) => {
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  if(!args.length) return _sendErr(msg.channel,"Usage: "+PREFIX+"play <song or URL>");
  const query=args.join(" ");
  const c=mc(0x1db954); c.addTextDisplayComponents(tx("🔍 Searching for **"+query+"**..."));
  const sent=await send(msg.channel,c);
  try {
    let player=kazagumo.players.get(msg.guild.id);
    if(!player){
      player=await kazagumo.createPlayer({guildId:msg.guild.id,textId:msg.channel.id,voiceId:msg.member.voice.channel.id,volume:80,deaf:true});
      player.data.set("channel",msg.channel);
    }
    const res=await kazagumo.search(query,{requester:msg.author});
    if(!res||!res.tracks.length){const u=mc(0xed4245);u.addTextDisplayComponents(tx("❌  No results found."));return sent.edit({components:[u],flags:F});}
    if(res.type==="PLAYLIST"){
      for(const t of res.tracks) player.queue.add(t);
      const u=mc(0x1db954);u.addTextDisplayComponents(tx("## ✅ Playlist Added\n**"+res.playlistName+"** — "+res.tracks.length+" tracks\n-# Requested by "+msg.author.username));sent.edit({components:[u],flags:F});
    } else {
      player.queue.add(res.tracks[0]);
      const u=mc(0x1db954);u.addTextDisplayComponents(tx("## ✅ Added to Queue\n**"+res.tracks[0].title+"**\n"+(res.tracks[0].author??"")+"\n-# Requested by "+msg.author.username));sent.edit({components:[u],flags:F});
    }
    if(!player.playing&&!player.paused) player.play();
  } catch(e) { console.error("[PLAY]",e); const u=mc(0xed4245);u.addTextDisplayComponents(tx("❌  Could not play that."));sent.edit({components:[u],flags:F}); }
});

reg("Music","skip",["s","next"],"Skip the current track",".skip", async (msg) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  const title=q.queue.current.title; q.skip(); _sendOk(msg.channel,"## ⏭️ Skipped\n**"+title+"**");
});

reg("Music","stop",["leave","dc"],"Stop music and leave the voice channel",".stop", async (msg) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  q.destroy(); _sendOk(msg.channel,"## ⏹️ Stopped\nQueue cleared and left the voice channel.");
});

reg("Music","pause",["paus"],"Pause the current track",".pause", async (msg) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  if(q.paused) return _sendErr(msg.channel,"Already paused. Use "+PREFIX+"resume.");
  q.pause(true); await refreshNP(q); _sendOk(msg.channel,"## ⏸️ Paused");
});

reg("Music","resume",["res","unpause"],"Resume the paused track",".resume", async (msg) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  if(!q.paused) return _sendErr(msg.channel,"Not paused. Use "+PREFIX+"pause.");
  q.pause(false); await refreshNP(q); _sendOk(msg.channel,"## ▶️ Resumed");
});

reg("Music","nowplaying",["np","current","playing"],"Show the currently playing track",".nowplaying", async (msg) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  const track=q.queue.current, loopMap={none:"🔄 Off",track:"🔂 Track",queue:"🔁 Queue"};
  const pos=q.position, total=track.length, filled=Math.min(Math.round((pos/total)*15),15);
  const bar="▬".repeat(filled)+"🔘"+"▬".repeat(15-filled);
  const c=mc(0x1db954); c.addTextDisplayComponents(tx("## 🎵 Now Playing\n**"+track.title+"**\n"+(track.author??"")+"  ·  "+msToTime(total))); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx(bar+"  "+msToTime(pos)+" / "+msToTime(total)+"\n\n**Volume:** "+q.volume+"%  ·  **Loop:** "+(loopMap[q.loop]??"Off")+"\n-# Requested by "+(track.requester?.username??"Unknown")));
  _send(msg.channel, c);
});

reg("Music","queue",["q2","list","tracklist"],"Show the current queue",".queue [page]", async (msg,args) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  const tracks=q.queue, current=q.queue.current;
  const c=mc(0x1db954); c.addTextDisplayComponents(tx("## 🎶 Queue  ·  "+(tracks.length+1)+" track(s)")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Now Playing:** "+current.title+"  ·  "+msToTime(current.length)));
  if(tracks.length){
    const page=Math.max(1,parseInt(args[0])||1)-1, slice=tracks.slice(page*10,(page+1)*10);
    c.addSeparatorComponents(sp()); c.addTextDisplayComponents(tx(slice.map((t,i)=>"**"+(page*10+i+1)+".** "+t.title+"  ·  "+msToTime(t.length)).join("\n")));
  }
  _send(msg.channel, c);
});

reg("Music","volume",["vol","v2"],"Set the playback volume (1–100)",".volume <1-100>", async (msg,args) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  const vol=parseInt(args[0]);
  if(isNaN(vol)||vol<1||vol>100) return _sendErr(msg.channel,"Usage: "+PREFIX+"volume <1-100>");
  q.setVolume(vol); await refreshNP(q); _sendOk(msg.channel,"## 🔊 Volume\nSet to **"+vol+"%**");
});

reg("Music","loop",["repeat","lp"],"Set loop mode (off/track/queue)",".loop <off|track|queue>", async (msg,args) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  const modes={off:"none",track:"track",queue:"queue"}, mode=args[0]?.toLowerCase();
  if(!mode||!(mode in modes)) return _sendErr(msg.channel,"Usage: "+PREFIX+"loop off / track / queue");
  q.setLoop(modes[mode]); await refreshNP(q); _sendOk(msg.channel,"## 🔁 Loop\nMode set to **"+mode+"**");
});

reg("Music","shuffle",["mix","shuf"],"Shuffle the queue",".shuffle", async (msg) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  if(q.queue.length<2) return _sendErr(msg.channel,"Not enough tracks to shuffle.");
  q.queue.shuffle(); _sendOk(msg.channel,"## 🔀 Shuffled\nQueue has been shuffled!");
});

reg("Music","remove",["rem","rmtrack"],"Remove a track from the queue by position",".remove <position>", async (msg,args) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  const pos=parseInt(args[0])-1;
  if(isNaN(pos)||pos<0||pos>=q.queue.length) return _sendErr(msg.channel,"Invalid position. See "+PREFIX+"queue.");
  const title=q.queue[pos].title; q.queue.splice(pos,1); _sendOk(msg.channel,"## 🗑️ Removed\n**"+title+"**");
});

reg("Music","clearqueue",["cq","clearq"],"Clear all tracks from the queue",".clearqueue", async (msg) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  q.queue.splice(0,q.queue.length); await refreshNP(q); _sendOk(msg.channel,"## 🗑️ Queue Cleared\nAll upcoming tracks removed.");
});

reg("Music","seek",["sk","seekto"],"Seek to a position in the track",".seek <time>  e.g. 1:30", async (msg,args) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  if(!args[0]) return _sendErr(msg.channel,"Usage: "+PREFIX+"seek 1:30");
  const parts=args[0].split(":").map(Number).reverse();
  const ms=((parts[2]||0)*3600+(parts[1]||0)*60+(parts[0]||0))*1000;
  if(!ms) return _sendErr(msg.channel,"Invalid time format. Use 1:30 or 0:45");
  await q.seek(ms); _sendOk(msg.channel,"## ⏩ Seeked\nJumped to **"+args[0]+"**");
});

reg("Music","skipto",["st","jump"],"Skip to a specific track in the queue",".skipto <position>", async (msg,args) => {
  const q=kazagumo.players.get(msg.guild.id);
  if(!q?.queue?.current) return _sendErr(msg.channel,"Nothing is playing right now.");
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  const pos=parseInt(args[0])-1;
  if(isNaN(pos)||pos<0||pos>=q.queue.length) return _sendErr(msg.channel,"Invalid position. See "+PREFIX+"queue.");
  q.queue.splice(0,pos); q.skip(); _sendOk(msg.channel,"## ⏭️ Jumped to track **"+(pos+1)+"**");
});

reg("Music","lyrics",["ly","lyric","song"],"Get song lyrics",".lyrics <artist> - <title>", async (msg,args) => {
  const raw=args.join(" "), split=raw.split("-").map(s=>s.trim());
  if(split.length<2||!split[0]||!split[1]) return _sendErr(msg.channel,"Usage: "+PREFIX+"lyrics Laufey - From The Start");
  const artist=split[0], title=split.slice(1).join("-").trim();
  const loading=await send(msg.channel,(()=>{const c=mc();c.addTextDisplayComponents(tx("🎵 Fetching lyrics..."));return c;})());
  let data; try{data=await fetchJSON("https://api.lyrics.ovh/v1/"+encodeURIComponent(artist)+"/"+encodeURIComponent(title));}catch{loading.delete().catch(()=>{});return _sendErr(msg.channel,"Could not reach the lyrics API.");}
  loading.delete().catch(()=>{});
  if(data.error||!data.lyrics) return _sendErr(msg.channel,"No lyrics found for **"+title+"** by **"+artist+"**.");
  const raw2=data.lyrics.replace(/\r\n/g,"\n").trim(), MAX=3800;
  if(raw2.length<=MAX){const c=mc(0x5865f2);c.addTextDisplayComponents(tx("## 🎵 "+title+"\n-# "+artist));c.addSeparatorComponents(sp());c.addTextDisplayComponents(tx(raw2));return send(msg.channel,c);}
  const chunks=[]; let remaining=raw2;
  while(remaining.length>0){let slice=remaining.slice(0,MAX);const nl=slice.lastIndexOf("\n");if(nl>MAX*0.6)slice=remaining.slice(0,nl);chunks.push(slice.trim());remaining=remaining.slice(slice.length).trimStart();}
  for(let i=0;i<chunks.length;i++){const c=mc(0x5865f2);c.addTextDisplayComponents(tx("## 🎵 "+title+(chunks.length>1?"  —  Part "+(i+1)+" of "+chunks.length:"")+"\n-# "+artist));c.addSeparatorComponents(sp());c.addTextDisplayComponents(tx(chunks[i]));await send(msg.channel,c);}
});

reg("Music","spotify",["sp","npspot"],"See what someone is listening to on Spotify",".spotify [@user]", async (msg) => {
  const target=msg.mentions?.members?.first()??msg.member;
  const act=target.presence?.activities.find(a=>a.name==="Spotify"&&a.type===ActivityType.Listening);
  if(!act) return _sendErr(msg.channel,"**"+target.user.username+"** is not listening to Spotify right now.");
  const c=mc(0x1db954); c.addTextDisplayComponents(tx("## 🎧 Spotify — "+target.user.username)); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Track:** "+(act.details??"Unknown")+"\n**Artist:** "+(act.state??"Unknown")+"\n**Album:** "+(act.assets?.largeText??"Unknown"))); _send(msg.channel, c);
});

reg("Tools","say",["echo"],"Bot sends a message via modal",".say", async (msg) => {
  const key="say:"+msg.author.id+":"+msg.channel.id;
  const c=mc(); c.addTextDisplayComponents(tx("## 💬 Say\nClick below to compose your message."));
  msg.channel.send({components:[c,modalBtn("openmodal:"+key,"Write Message")],flags:F,allowedMentions:{parse:[]}});
});

reg("Tools","announce",["ann","announcement"],"Post an announcement to a channel",".announce #channel", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageMessages)) return _sendErr(msg.channel,"Missing ManageMessages permission.");
  const target=msg.mentions?.channels?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"announce #channel");
  const key="announce:"+msg.author.id+":"+target.id;
  const c=mc(0x5865f2); c.addTextDisplayComponents(tx("## 📢 Announce\nClick below to write your announcement for "+target+"."));
  msg.channel.send({components:[c,modalBtn("openmodal:"+key,"Write Announcement")],flags:F,allowedMentions:{parse:[]}});
});

reg("Tools","poll",["vote"],"Create a yes/no poll via modal",".poll", async (msg) => {
  const key="poll:"+msg.author.id+":"+msg.channel.id;
  const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 📊 Create Poll\nClick below to write your poll question."));
  msg.channel.send({components:[c,modalBtn("openmodal:"+key,"Write Question")],flags:F,allowedMentions:{parse:[]}});
});

reg("Tools","poll2",["mpoll","multipoll"],"Create a multi-choice poll",".poll2 <question> | <opt1> | <opt2>...", async (msg,args) => {
  const parts=args.join(" ").split("|").map(s=>s.trim()).filter(Boolean);
  if(parts.length<3) return _sendErr(msg.channel,"Usage: "+PREFIX+"poll2 Best food? | Pizza | Sushi | Tacos");
  const [question,...options]=parts; if(options.length>9) return _sendErr(msg.channel,"Max 9 options.");
  const nums=["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
  const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 📊 Poll\n"+question+"\n\n"+options.map((o,i)=>nums[i]+"  "+o).join("\n")+"\n\n-# Asked by "+msg.author.username));
  const m=await send(msg.channel,c); for(let i=0;i<options.length;i++) await m.react(nums[i]).catch(()=>{});
});

reg("Tools","stealemoji",["steal","addemoji","se"],"Copy an emoji to this server",".stealemoji <emoji> [name]", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageEmojisAndStickers)) return _sendErr(msg.channel,"Missing ManageEmojisAndStickers permission.");
  const match=args[0]?.match(/^<a?:(\w+):(\d+)>$/); if(!match) return _sendErr(msg.channel,"Usage: "+PREFIX+"stealemoji <emoji> [name]");
  const [,ename,eid]=match, url="https://cdn.discordapp.com/emojis/"+eid+"."+(args[0].startsWith("<a:")?"gif":"png");
  const emoji=await msg.guild.emojis.create({attachment:url,name:args[1]??ename});
  _sendOk(msg.channel,"## ✅ Emoji Added\n"+emoji+"  "+emoji.name);
});

reg("Tools","note",["notes"],"Personal notes",".note add | list | clear", async (msg,args) => {
  const sub=args[0]?.toLowerCase(), uid=msg.author.id;
  if(sub==="add"){
    const c=mc(); c.addTextDisplayComponents(tx("## 📝 Add Note\nClick below to write your note."));
    return msg.channel.send({components:[c,modalBtn("openmodal:note:"+uid,"Write Note")],flags:F,allowedMentions:{parse:[]}});
  } else if(sub==="list"){
    const list=notes.get(uid)??[]; if(!list.length) return _sendErr(msg.channel,"You have no notes.");
    paginate(msg.channel,uid,list,10,(n,i)=>"**"+(i+1)+".** "+n.text+"\n  -# <t:"+Math.floor(n.at/1000)+":R>","📝 Your Notes");
  } else if(sub==="clear"){notes.delete(uid);_sendOk(msg.channel,"## ✅ Notes Cleared");}
  else _sendErr(msg.channel,"Usage: "+PREFIX+"note add / list / clear");
});

reg("Tools","tag",["tags","snippet"],"Server text snippets",".tag set | get | list | delete", async (msg,args) => {
  const sub=args[0]?.toLowerCase(), name=args[1]?.toLowerCase();
  if(sub==="set"){
    if(!name) return _sendErr(msg.channel,"Usage: "+PREFIX+"tag set <name>");
    const key="tag:"+msg.author.id+":"+name;
    const c=mc(); c.addTextDisplayComponents(tx("## 🏷️ Set Tag: "+name+"\nClick below to write the content."));
    return msg.channel.send({components:[c,modalBtn("openmodal:"+key,"Write Tag Content")],flags:F,allowedMentions:{parse:[]}});
  } else if(sub==="get"){
    const tag=tags.get(name); if(!tag) return _sendErr(msg.channel,"Tag "+name+" not found.");
    const c=mc(); c.addTextDisplayComponents(tx(tag.text)); send(msg.channel,c);
  } else if(sub==="list"){
    if(!tags.size) return _sendErr(msg.channel,"No tags saved.");
    paginate(msg.channel,msg.author.id,[...tags.keys()],20,k=>"**"+k+"** — by "+(tags.get(k)?.author??"?"),"🏷️ Tags");
  } else if(sub==="delete"){
    if(!tags.has(name)) return _sendErr(msg.channel,"Tag "+name+" not found.");
    tags.delete(name); _sendOk(msg.channel,"## ✅ Tag Deleted\n**"+name+"** removed.");
  } else _sendErr(msg.channel,"Usage: "+PREFIX+"tag set / get / list / delete");
});

reg("Tools","password",["pass","pw","genpass"],"Generate a secure password",".password [length]", async (msg,args) => {
  const len=Math.min(Math.max(parseInt(args[0])||16,8),64);
  const c=mc(0x57f287); c.addTextDisplayComponents(tx("## 🔑 Password Generated\n"+genPass(len)+"\n\n-# Length: "+len+"  ·  Keep this private!")); _send(msg.channel, c);
});

reg("Tools","weather",["wthr","forecast"],"Get weather for a city",".weather <city>",
  cmd=>cmd.addStringOption(o=>o.setName("city").setDescription("City name").setRequired(true)),
  async (msg,args) => {
    const city=msg._interaction?.options?.getString("city")||args.join(" ");
    if(!city) return _sendErr(msg.channel,"Usage: "+PREFIX+"weather London");
    let data; try{data=await fetchJSON("https://wttr.in/"+encodeURIComponent(city)+"?format=j1");}catch{return _sendErr(msg.channel,"Could not fetch weather.");}
    const cur=data.current_condition?.[0], area=data.nearest_area?.[0]; if(!cur) return _sendErr(msg.channel,"No weather data found.");
    const location=(area?.areaName?.[0]?.value??city)+", "+(area?.country?.[0]?.value??"");
    const c=mc(0x5488c8); c.addTextDisplayComponents(tx("## ☁️ Weather — "+location)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**Condition:** "+cur.weatherDesc?.[0]?.value+"\n**Temperature:** "+cur.temp_C+"°C  /  "+cur.temp_F+"°F\n**Feels Like:** "+cur.FeelsLikeC+"°C\n**Humidity:** "+cur.humidity+"%\n**Wind:** "+cur.windspeedKmph+" km/h")); _send(msg.channel, c);
  });

reg("Tools","define",["def","dictionary","dict"],"Look up a word definition",".define <word>",
  cmd=>cmd.addStringOption(o=>o.setName("word").setDescription("Word to define").setRequired(true)),
  async (msg,args) => {
    const word=msg._interaction?.options?.getString("word")||args[0];
    if(!word) return _sendErr(msg.channel,"Usage: "+PREFIX+"define serendipity");
    let data; try{data=await fetchJSON("https://api.dictionaryapi.dev/api/v2/entries/en/"+encodeURIComponent(word.toLowerCase()));}catch{return _sendErr(msg.channel,"Could not reach dictionary API.");}
    if(!Array.isArray(data)||!data[0]) return _sendErr(msg.channel,"No definition found for **"+word+"**.");
    const entry=data[0], meaning=entry.meanings?.[0], def=meaning?.definitions?.[0];
    const c=mc(0x5865f2); c.addTextDisplayComponents(tx("## 📖 "+entry.word+(entry.phonetic?"  "+entry.phonetic:""))); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**Part of speech:** "+(meaning?.partOfSpeech??"Unknown")+"\n\n"+(def?.definition??"No definition.")+(def?.example?"\n\n**Example:** "+def.example:""))); _send(msg.channel, c);
  });

reg("Tools","urban",["ud","urb","slang"],"Look up a term on Urban Dictionary",".urban <term>",
  cmd=>cmd.addStringOption(o=>o.setName("term").setDescription("Term to look up").setRequired(true)),
  async (msg,args) => {
    const term=msg._interaction?.options?.getString("term")||args.join(" ");
    if(!term) return _sendErr(msg.channel,"Usage: "+PREFIX+"urban yeet");
    let data; try{data=await fetchJSON("https://api.urbandictionary.com/v0/define?term="+encodeURIComponent(term));}catch{return _sendErr(msg.channel,"Could not reach Urban Dictionary.");}
    const result=data.list?.[0]; if(!result) return _sendErr(msg.channel,"No Urban Dictionary entry found.");
    const c=mc(0x1d3461); c.addTextDisplayComponents(tx("## 📚 "+result.word)); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx(result.definition.replace(/\[|\]/g,"").slice(0,600)+(result.example?"\n\n**Example:** "+result.example.replace(/\[|\]/g,"").slice(0,300):"")+"\n\n👍 "+result.thumbs_up+"  ·  👎 "+result.thumbs_down)); _send(msg.channel, c);
  });

reg("Tools","qr",["qrcode","qrgen"],"Generate a QR code",".qr <text>",
  cmd=>cmd.addStringOption(o=>o.setName("text").setDescription("Text or URL").setRequired(true)),
  async (msg,args) => {
    const text=msg._interaction?.options?.getString("text")||args.join(" ");
    if(!text) return _sendErr(msg.channel,"Usage: "+PREFIX+"qr <url or text>");
    const url="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data="+encodeURIComponent(text);
    const c=mc(); c.addTextDisplayComponents(tx("## 📷 QR Code\n**Data:** "+text+"\n\n[Open QR Code]("+url+")\n"+url)); _send(msg.channel, c);
  });

reg("Tools","currency",["convert","fx","exchange"],"Convert currency",".currency <amount> <from> <to>",
  cmd=>cmd.addNumberOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)).addStringOption(o=>o.setName("from").setDescription("From currency (e.g. USD)").setRequired(true)).addStringOption(o=>o.setName("to").setDescription("To currency (e.g. EUR)").setRequired(true)),
  async (msg,args) => {
    const amount=parseFloat(msg._interaction?.options?.getNumber("amount")??args[0]);
    const from=(msg._interaction?.options?.getString("from")??args[1])?.toUpperCase();
    const to=(msg._interaction?.options?.getString("to")??args[2])?.toUpperCase();
    if(isNaN(amount)||!from||!to) return _sendErr(msg.channel,"Usage: "+PREFIX+"currency 100 USD EUR");
    let data; try{data=await fetchJSON("https://open.er-api.com/v6/latest/"+from);}catch{return _sendErr(msg.channel,"Could not fetch exchange rates.");}
    if(data.result!=="success") return _sendErr(msg.channel,"Invalid currency: "+from);
    const rate=data.rates[to]; if(!rate) return _sendErr(msg.channel,"Unknown target currency: "+to);
    const c=mc(0x57f287); c.addTextDisplayComponents(tx("## 💱 Currency\n**"+amount+" "+from+"** = **"+(amount*rate).toFixed(2)+" "+to+"**\n-# Rate: 1 "+from+" = "+rate+" "+to)); _send(msg.channel, c);
  });

reg("Tools","addrole",["ar","giverole","gr"],"Give a role to a member",".addrole @user @role", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageRoles)) return _sendErr(msg.channel,"Missing ManageRoles permission.");
  const target=msg.mentions?.members?.first(), role=msg.mentions?.roles?.first();
  if(!target||!role) return _sendErr(msg.channel,"Usage: "+PREFIX+"addrole @user @role");
  if(role.position>=msg.guild.members.me.roles.highest.position) return _sendErr(msg.channel,"That role is higher than my highest role.");
  await target.roles.add(role); _sendOk(msg.channel,"## ✅ Role Added\nGave "+role+" to **"+target.user.tag+"**.");
});

reg("Tools","removerole",["rr","takerole","delrole"],"Take a role from a member",".removerole @user @role", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageRoles)) return _sendErr(msg.channel,"Missing ManageRoles permission.");
  const target=msg.mentions?.members?.first(), role=msg.mentions?.roles?.first();
  if(!target||!role) return _sendErr(msg.channel,"Usage: "+PREFIX+"removerole @user @role");
  await target.roles.remove(role); _sendOk(msg.channel,"## ✅ Role Removed\nRemoved "+role+" from **"+target.user.tag+"**.");
});

reg("Tools","createrole",["newrole","mkrole"],"Create a new role",".createrole <name> [#hex]", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageRoles)) return _sendErr(msg.channel,"Missing ManageRoles permission.");
  const hex=args.find(a=>/^#?[0-9a-fA-F]{6}$/.test(a))?.replace("#","");
  const name=args.filter(a=>!/^#?[0-9a-fA-F]{6}$/.test(a)).join(" "); if(!name) return _sendErr(msg.channel,"Usage: "+PREFIX+"createrole <name> [#hex]");
  const role=await msg.guild.roles.create({name,color:hex?parseInt(hex,16):0,reason:"Created by "+msg.author.tag});
  const c=mc(role.color||0x5865f2); c.addTextDisplayComponents(tx("## ✅ Role Created\n**"+role.name+"**  ·  ID: "+role.id)); _send(msg.channel, c);
});

reg("Tools","deleterole",["rmrole","remrole"],"Delete a role",".deleterole @role", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageRoles)) return _sendErr(msg.channel,"Missing ManageRoles permission.");
  const role=msg.mentions?.roles?.first(); if(!role) return _sendErr(msg.channel,"Usage: "+PREFIX+"deleterole @role");
  confirm(msg,"Delete the role **"+role.name+"**? This cannot be undone.", async()=>{
    await role.delete("Deleted by "+msg.author.tag); _sendOk(msg.channel,"## ✅ Role Deleted\n**"+role.name+"** removed.");
  });
});

reg("Tools","setcolor",["rolecolor","rc"],"Change a role color",".setcolor @role #hex", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageRoles)) return _sendErr(msg.channel,"Missing ManageRoles permission.");
  const role=msg.mentions?.roles?.first(), hex=args.find(a=>/^#?[0-9a-fA-F]{6}$/.test(a))?.replace("#","");
  if(!role||!hex) return _sendErr(msg.channel,"Usage: "+PREFIX+"setcolor @role #ff5733");
  await role.setColor(parseInt(hex,16));
  const c=mc(parseInt(hex,16)); c.addTextDisplayComponents(tx("## 🎨 Role Color Updated\n**"+role.name+"** → #"+hex.toUpperCase())); _send(msg.channel, c);
});

reg("Tools","massrole",["mr","roleall"],"Add a role to every member",".massrole @role", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.Administrator)) return _sendErr(msg.channel,"You need Administrator permission for this.");
  const role=msg.mentions?.roles?.first(); if(!role) return _sendErr(msg.channel,"Usage: "+PREFIX+"massrole @role");
  await msg.guild.members.fetch();
  const members=msg.guild.members.cache.filter(m=>!m.user.bot&&!m.roles.cache.has(role.id));
  confirm(msg,"Add "+role+" to **"+members.size+"** members?\nThis may take a while.", async()=>{
    const m=await sendOk(msg.channel,"## ⏳ Adding role..."); let done=0;
    for(const[,member]of members){await member.roles.add(role).catch(()=>{});done++;}
    const c=mc(0x57f287);c.addTextDisplayComponents(tx("## ✅ Mass Role Done\nAdded "+role+" to **"+done+"** members."));m.edit({components:[c],flags:F});
  });
});

reg("Fun","roll",["d","die"],"Roll a die",".roll [sides]", async (msg,args) => {
  const sides=parseInt(args[0])||6; if(sides<2||sides>10000) return _sendErr(msg.channel,"Sides must be 2–10000.");
  const c=mc(0xeb459e); c.addTextDisplayComponents(tx("## 🎲 d"+sides+" → "+(Math.floor(Math.random()*sides)+1))); _send(msg.channel, c);
});

reg("Fun","dice",["multidice"],"Roll multiple dice (e.g. 2d6)",".dice <NdS>",
  cmd=>cmd.addStringOption(o=>o.setName("notation").setDescription("e.g. 2d6").setRequired(true)),
  async (msg,args) => {
    const raw=msg._interaction?.options?.getString("notation")||args[0];
    const match=raw?.match(/^(\d+)d(\d+)$/i); if(!match) return _sendErr(msg.channel,"Usage: "+PREFIX+"dice 2d6");
    const num=Math.min(parseInt(match[1]),20), sides=Math.min(parseInt(match[2]),1000);
    if(num<1||sides<2) return _sendErr(msg.channel,"Invalid notation.");
    const rolls=Array.from({length:num},()=>Math.floor(Math.random()*sides)+1);
    const c=mc(0xeb459e); c.addTextDisplayComponents(tx("## 🎲 "+num+"d"+sides+"\nRolls: "+rolls.join(", ")+"\nTotal: **"+rolls.reduce((a,b)=>a+b,0)+"**")); _send(msg.channel, c);
  });

reg("Fun","coinflip",["cf","flip","toss"],"Heads or tails",".coinflip", async (msg) => {
  const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 🪙 "+(Math.random()<0.5?"Heads":"Tails"))); _send(msg.channel, c);
});

reg("Fun","8ball",["8b","ball","magic"],"Magic 8-ball",".8ball <question>",
  cmd=>cmd.addStringOption(o=>o.setName("question").setDescription("Your question").setRequired(true)),
  async (msg,args) => {
    const q=msg._interaction?.options?.getString("question")||args.join(" ");
    if(!q) return _sendErr(msg.channel,"Usage: "+PREFIX+"8ball <question>");
    const c=mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🎱 Magic 8-Ball")); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**Q:** "+q+"\n**A:** "+BALL[Math.floor(Math.random()*BALL.length)])); _send(msg.channel, c);
  });

reg("Fun","choose",["pick","pickone"],"Pick randomly from a list",".choose a, b, c",
  cmd=>cmd.addStringOption(o=>o.setName("options").setDescription("Comma-separated options").setRequired(true)),
  async (msg,args) => {
    const raw=msg._interaction?.options?.getString("options")||args.join(" ");
    const opts=raw.split(",").map(s=>s.trim()).filter(Boolean); if(opts.length<2) return _sendErr(msg.channel,"Usage: "+PREFIX+"choose pizza, sushi, ramen");
    const c=mc(0x57f287); c.addTextDisplayComponents(tx("## 🤔 I choose: **"+opts[Math.floor(Math.random()*opts.length)]+"**\nOptions: "+opts.join(", "))); _send(msg.channel, c);
  });

reg("Fun","calculate",["calc","math"],"Math expression evaluator",".calculate <expression>",
  cmd=>cmd.addStringOption(o=>o.setName("expression").setDescription("Math expression").setRequired(true)),
  async (msg,args) => {
    const expr=msg._interaction?.options?.getString("expression")||args.join(" ");
    if(!expr) return _sendErr(msg.channel,"Usage: "+PREFIX+"calculate (10+5)*2");
    let result; try{if(!/^[0-9+\-*/(). %]+$/.test(expr))throw 0;result=Function('"use strict";return('+expr+')')();if(!isFinite(result))throw 0;}catch{return _sendErr(msg.channel,"Invalid expression: "+expr);}
    const c=mc(); c.addTextDisplayComponents(tx("## 🧮 "+expr+" = **"+result+"**")); _send(msg.channel, c);
  });

reg("Fun","random",["rand","rng"],"Random number in a range",".random <min> <max>",
  cmd=>cmd.addIntegerOption(o=>o.setName("min").setDescription("Minimum").setRequired(true)).addIntegerOption(o=>o.setName("max").setDescription("Maximum").setRequired(true)),
  async (msg,args) => {
    const min=parseInt(msg._interaction?.options?.getInteger("min")??args[0]);
    const max=parseInt(msg._interaction?.options?.getInteger("max")??args[1]);
    if(isNaN(min)||isNaN(max)||min>=max) return _sendErr(msg.channel,"Usage: "+PREFIX+"random 1 100");
    const c=mc(0xeb459e); c.addTextDisplayComponents(tx("## 🎰 "+min+" – "+max+" → **"+(Math.floor(Math.random()*(max-min+1))+min)+"**")); _send(msg.channel, c);
  });

reg("Fun","ship",["love","lovecalc"],"Ship two users",".ship @user1 @user2", async (msg) => {
  const users=[...msg.mentions?.users?.values()??[]]; if(users.length<2) return _sendErr(msg.channel,"Usage: "+PREFIX+"ship @user1 @user2");
  const pct=Math.floor(Math.random()*101), bars=Math.round(pct/10), emoji=pct>=75?"💕":pct>=50?"💛":pct>=25?"🤔":"💔";
  const c=mc(0xff6b9d); c.addTextDisplayComponents(tx("## 💘 Ship\n**"+users[0].username+"** + **"+users[1].username+"**\n\n"+emoji+" **"+pct+"%** compatibility\n"+"█".repeat(bars)+"░".repeat(10-bars))); _send(msg.channel, c);
});

reg("Fun","rate",["rateme","score"],"Rate something out of 10",".rate <thing>",
  cmd=>cmd.addStringOption(o=>o.setName("thing").setDescription("Thing to rate").setRequired(true)),
  async (msg,args) => {
    const thing=msg._interaction?.options?.getString("thing")||args.join(" ");
    if(!thing) return _sendErr(msg.channel,"Usage: "+PREFIX+"rate pizza");
    const score=Math.floor(Math.random()*11);
    const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## ⭐ Rating\n**"+thing+"**\n\n"+"⭐".repeat(score)+"☆".repeat(10-score)+"\n**"+score+" / 10**")); _send(msg.channel, c);
  });

reg("Fun","roast",["burn","insult"],"Roast someone",".roast [@user]", async (msg) => {
  const target=msg.mentions?.users?.first()?.username??msg.author.username;
  const c=mc(0xed4245); c.addTextDisplayComponents(tx("## 🔥 Roast\n**"+target+"**, "+ROASTS[Math.floor(Math.random()*ROASTS.length)])); _send(msg.channel, c);
});

reg("Fun","compliment",["comp","nice","praise"],"Compliment someone",".compliment [@user]", async (msg) => {
  const target=msg.mentions?.users?.first()?.username??msg.author.username;
  const c=mc(0x57f287); c.addTextDisplayComponents(tx("## 💛 Compliment\n**"+target+"**, "+COMPLIMENTS[Math.floor(Math.random()*COMPLIMENTS.length)])); _send(msg.channel, c);
});

reg("Fun","fact",["funfact","randomfact"],"Get a random fun fact",".fact", async (msg) => {
  let data; try{data=await fetchJSON("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");}catch{return _sendErr(msg.channel,"Could not fetch a fact.");}
  const c=mc(0x5865f2); c.addTextDisplayComponents(tx("## 💡 Random Fact\n"+(data.text??"No fact found."))); _send(msg.channel, c);
});

reg("Fun","joke",["jk","lol","funny"],"Get a random joke",".joke", async (msg) => {
  let data; try{data=await fetchJSON("https://official-joke-api.appspot.com/random_joke");}catch{return _sendErr(msg.channel,"Could not fetch a joke.");}
  const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 😂 Joke\n"+data.setup+"\n\n||"+data.punchline+"||")); _send(msg.channel, c);
});

reg("Fun","quote",["qte","inspire"],"Get a random quote",".quote", async (msg) => {
  let data; try{data=await fetchJSON("https://zenquotes.io/api/random");}catch{return _sendErr(msg.channel,"Could not fetch a quote.");}
  const q=data[0]; const c=mc(0x5865f2); c.addTextDisplayComponents(tx('## 💬 Quote\n"'+q.q+'"\n\n— '+q.a)); _send(msg.channel, c);
});

reg("Fun","dare",["d2","challenge"],"Get a random dare",".dare", async (msg) => {
  const c=mc(0xeb459e); c.addTextDisplayComponents(tx("## 😈 Dare\n"+DARES[Math.floor(Math.random()*DARES.length)])); _send(msg.channel, c);
});

reg("Fun","truth",["tr","confess"],"Get a random truth question",".truth", async (msg) => {
  const c=mc(0x5865f2); c.addTextDisplayComponents(tx("## 🤫 Truth\n"+TRUTHS[Math.floor(Math.random()*TRUTHS.length)])); _send(msg.channel, c);
});

reg("Fun","wyr",["wouldyourather"],"Get a would you rather question",".wyr", async (msg) => {
  const c=mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🤔 Would You Rather\n"+WYR[Math.floor(Math.random()*WYR.length)])); _send(msg.channel, c);
});

reg("Fun","rps",["rockpaperscissors"],"Rock paper scissors vs the bot",".rps <rock|paper|scissors>",
  cmd=>cmd.addStringOption(o=>o.setName("choice").setDescription("rock, paper, or scissors").setRequired(true).addChoices({name:"Rock",value:"rock"},{name:"Paper",value:"paper"},{name:"Scissors",value:"scissors"})),
  async (msg,args) => {
    const choices=["rock","paper","scissors"],emojis={rock:"🪨",paper:"📄",scissors:"✂️"},beats={rock:"scissors",paper:"rock",scissors:"paper"};
    const player2=msg._interaction?.options?.getString("choice")||args[0]?.toLowerCase();
    if(!choices.includes(player2)) return _sendErr(msg.channel,"Usage: "+PREFIX+"rps rock / paper / scissors");
    const bot=choices[Math.floor(Math.random()*3)];
    const result=player2===bot?"Draw!":beats[player2]===bot?"You Win! 🎉":"Bot Wins! 🤖";
    const c=mc(beats[player2]===bot?0x57f287:player2===bot?0xfee75c:0xed4245);
    c.addTextDisplayComponents(tx("## ✂️ Rock Paper Scissors\n**You:** "+emojis[player2]+" "+player2+"\n**Bot:** "+emojis[bot]+" "+bot+"\n\n**"+result+"**")); _send(msg.channel, c);
  });

reg("Fun","slot",["slots","slotmachine"],"Play the slot machine",".slot", async (msg) => {
  const symbols=["🍒","🍋","🍊","🍇","⭐","💎","🎰","7️⃣"];
  const reels=Array.from({length:3},()=>symbols[Math.floor(Math.random()*symbols.length)]);
  const win=reels.every(r=>r===reels[0]), jackpot=win&&reels[0]==="7️⃣";
  const c=mc(jackpot?0xffd700:win?0x57f287:0x5865f2);
  c.addTextDisplayComponents(tx("## 🎰 Slot Machine\n"+reels.join("  ")+"\n\n"+(jackpot?"**JACKPOT! 🎉🎉🎉**":win?"**Winner! 🎉**":"No match. Try again!"))); _send(msg.channel, c);
});

reg("Fun","affirmation",["affirm","selfcare"],"Get a positive affirmation",".affirmation", async (msg) => {
  const c=mc(0xf4a7b9); c.addTextDisplayComponents(tx("## 🌸 Affirmation\n"+AFFIRMATIONS[Math.floor(Math.random()*AFFIRMATIONS.length)])); _send(msg.channel, c);
});

reg("Fun","horoscope",["horo","zodiac","starsign"],"Get info about a zodiac sign",".horoscope <sign>",
  cmd=>cmd.addStringOption(o=>o.setName("sign").setDescription("Zodiac sign").setRequired(true).addChoices(...Object.keys(ZODIAC).map(k=>({name:k.charAt(0).toUpperCase()+k.slice(1),value:k})))),
  async (msg,args) => {
    const sign=(msg._interaction?.options?.getString("sign")||args[0])?.toLowerCase().replace(/[^a-z]/g,""), data=ZODIAC[sign];
    if(!data) return _sendErr(msg.channel,"Unknown sign. Options: "+Object.keys(ZODIAC).join(", "));
    const c=mc(0x9b59b6); c.addTextDisplayComponents(tx("## "+data.symbol+" "+sign.charAt(0).toUpperCase()+sign.slice(1))); c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**Dates:** "+data.dates+"\n**Traits:** "+data.trait)); _send(msg.channel, c);
  });

reg("Fun","catfact",["cat","meow","cats"],"Get a random cat fact",".catfact", async (msg) => {
  let data; try{data=await fetchJSON("https://catfact.ninja/fact");}catch{return _sendErr(msg.channel,"Could not fetch a cat fact.");}
  const c=mc(0xf39c12); c.addTextDisplayComponents(tx("## 🐱 Cat Fact\n"+data.fact)); _send(msg.channel, c);
});

reg("Fun","dogfact",["dog","woof","dogs"],"Get a random dog fact",".dogfact", async (msg) => {
  let data; try{data=await fetchJSON("https://dogapi.dog/api/v2/facts");}catch{return _sendErr(msg.channel,"Could not fetch a dog fact.");}
  const fact=data.data?.[0]?.attributes?.body; if(!fact) return _sendErr(msg.channel,"No dog fact received.");
  const c=mc(0xa0522d); c.addTextDisplayComponents(tx("## 🐶 Dog Fact\n"+fact)); _send(msg.channel, c);
});

reg("Fun","riddle",["puzzle","rd"],"Get a random riddle",".riddle", async (msg) => {
  const riddles=[["I speak without a mouth and hear without ears. What am I?","An echo"],["The more you take, the more you leave behind. What am I?","Footsteps"],["What has keys but no locks, space but no room?","A keyboard"],["I go up but never come down. What am I?","Your age"],["What has hands but can't clap?","A clock"]];
  const [q,a]=riddles[Math.floor(Math.random()*riddles.length)];
  const c=mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🧩 Riddle\n"+q+"\n\n-# Answer: ||"+a+"||")); _send(msg.channel, c);
});

reg("Fun","trivia",["quiz"],"Get a random trivia question",".trivia", async (msg) => {
  let data; try{data=await fetchJSON("https://opentdb.com/api.php?amount=1&type=multiple");}catch{return _sendErr(msg.channel,"Could not fetch trivia.");}
  const q=data.results?.[0]; if(!q) return _sendErr(msg.channel,"No trivia received.");
  const all=[...q.incorrect_answers,q.correct_answer].sort(()=>Math.random()-0.5);
  const c=mc(0x5865f2); c.addTextDisplayComponents(tx("## 🧠 Trivia")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Category:** "+htmlDecode(q.category)+"\n**Difficulty:** "+q.difficulty+"\n\n"+htmlDecode(q.question)+"\n\n"+all.map((a,i)=>(i+1)+".  "+htmlDecode(a)).join("\n")+"\n\n-# Answer: ||"+htmlDecode(q.correct_answer)+"||")); _send(msg.channel, c);
});

reg("Fun","reverse",["rev"],"Reverse text",".reverse <text>",
  cmd=>cmd.addStringOption(o=>o.setName("text").setDescription("Text to reverse").setRequired(true)),
  async (msg,args) => {
    const text=msg._interaction?.options?.getString("text")||args.join(" ");
    if(!text) return _sendErr(msg.channel,"Usage: "+PREFIX+"reverse <text>");
    const c=mc(); c.addTextDisplayComponents(tx("## 🔄 "+text.split("").reverse().join(""))); _send(msg.channel, c);
  });

reg("Fun","mock",["spongebob","sb"],"SpOnGeBoB mock text",".mock <text>",
  cmd=>cmd.addStringOption(o=>o.setName("text").setDescription("Text to mock").setRequired(true)),
  async (msg,args) => {
    const text=msg._interaction?.options?.getString("text")||args.join(" ");
    if(!text) return _sendErr(msg.channel,"Usage: "+PREFIX+"mock <text>");
    const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 🧽 "+text.split("").map((ch,i)=>i%2?ch.toUpperCase():ch.toLowerCase()).join(""))); _send(msg.channel, c);
  });

reg("Fun","clap",["claptext"],"Add 👏 between words",".clap <text>",
  cmd=>cmd.addStringOption(o=>o.setName("text").setDescription("Text to clap").setRequired(true)),
  async (msg,args) => {
    const text=msg._interaction?.options?.getString("text")||args.join(" ");
    if(!text) return _sendErr(msg.channel,"Usage: "+PREFIX+"clap <text>");
    const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 👏 "+text.split(" ").join(" 👏 ")+" 👏")); _send(msg.channel, c);
  });

reg("Fun","never",["nhie"],"Never have I ever question",".never", async (msg) => {
  const questions=["Never have I ever stayed up past 3am for no reason.","Never have I ever googled myself.","Never have I ever cried at a movie.","Never have I ever sent a text to the wrong person.","Never have I ever faked being sick to skip something."];
  const c=mc(0x9b59b6); c.addTextDisplayComponents(tx("## 🙅 Never Have I Ever\n"+questions[Math.floor(Math.random()*questions.length)])); _send(msg.channel, c);
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
for(const [endpoint,alias,verb] of ACTION_DEFS){
  reg("Actions",endpoint,[alias],verb.charAt(0).toUpperCase()+verb.slice(1)+" someone","."+endpoint+" [@user]", async (msg) => {
    const target=msg.mentions?.users?.first();
    const label=target?"<@"+msg.author.id+"> "+verb+" <@"+target.id+">":"<@"+msg.author.id+"> "+verb;
    const embed=new EmbedBuilder().setDescription(label).setColor(0x5865f2);
    const sent=await msg.channel.send({embeds:[embed]});
    fetchJSON("https://nekos.best/api/v2/"+endpoint).then(data=>{
      const gif=data.results?.[0]?.url;
      if(gif) sent.edit({embeds:[EmbedBuilder.from(sent.embeds[0]).setImage(gif)]});
    }).catch(()=>{});
  });
}

reg("AFK","afk",["away","brb"],"Set your AFK status",".afk [reason]", async (msg,args) => {
  if(args.length){
    afkStore.set(msg.author.id,{reason:args.join(" "),since:Date.now()});
    const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 💤 AFK Set\n**Reason:** "+args.join(" "))); return send(msg.channel,c);
  }
  const c=mc(0xfee75c); c.addTextDisplayComponents(tx("## 💤 Set AFK\nClick below to set your AFK reason."));
  msg.channel.send({components:[c,modalBtn("openmodal:afk:"+msg.author.id,"Set AFK Reason")],flags:F,allowedMentions:{parse:[]}});
});

reg("AFK","afklist",["afkall","listafk"],"Show everyone currently AFK",".afklist", async (msg) => {
  if(!afkStore.size) return _sendErr(msg.channel,"Nobody is AFK right now.");
  const list=[...afkStore.entries()];
  paginate(msg.channel,msg.author.id,list,10,([id,d])=>"<@"+id+"> — "+d.reason+" ("+fmtDur(Date.now()-d.since)+" ago)","💤 AFK Members ("+list.length+")");
});

reg("AFK","unafk",["removeafk","clearafk"],"Remove someone's AFK status (mod only)",".unafk @user", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ModerateMembers)) return _sendErr(msg.channel,"Missing ModerateMembers permission.");
  const target=msg.mentions?.users?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"unafk @user");
  if(!afkStore.has(target.id)) return _sendErr(msg.channel,"**"+target.username+"** is not AFK.");
  afkStore.delete(target.id); _sendOk(msg.channel,"## ✅ AFK Removed\n**"+target.tag+"** is no longer AFK.");
});

reg("Snipe","snipe",["sn"],"Show the last deleted message",".snipe", async (msg) => {
  const d=snipeStore.get(msg.channel.id); if(!d) return _sendErr(msg.channel,"Nothing to snipe in this channel.");
  const c=mc(); c.addTextDisplayComponents(tx("## 🔍 Sniped")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Author:** "+d.author+"\n**Deleted:** <t:"+Math.floor(d.at/1000)+":R>\n\n"+(d.content||"(no text)"))); _send(msg.channel, c);
});

reg("Snipe","editsnipe",["es","esnipe"],"Show the last edited message",".editsnipe", async (msg) => {
  const d=esnipeStore.get(msg.channel.id); if(!d) return _sendErr(msg.channel,"Nothing to editsnipe in this channel.");
  const c=mc(); c.addTextDisplayComponents(tx("## ✏️ Edit Sniped")); c.addSeparatorComponents(sp());
  c.addTextDisplayComponents(tx("**Author:** "+d.author+"\n**Edited:** <t:"+Math.floor(d.at/1000)+":R>\n\n**Before:**\n"+(d.before||"(empty)")+"\n\n**After:**\n"+(d.after||"(empty)"))); _send(msg.channel, c);
});

reg("Snipe","clearsnipe",["cs2","wipesnipe"],"Clear the snipe cache for this channel",".clearsnipe", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageMessages)) return _sendErr(msg.channel,"Missing ManageMessages permission.");
  snipeStore.delete(msg.channel.id); esnipeStore.delete(msg.channel.id); _sendOk(msg.channel,"## ✅ Snipe Cleared");
});

reg("Reminders","remind",["reminder","remindme"],"Set a timed reminder",".remind <time> <message>", async (msg,args) => {
  const ms=parseTime(args[0]), text=args.slice(1).join(" ");
  if(ms&&text){
    const fireAt=Date.now()+ms;
    reminders.push({id:msg.author.id+"-"+fireAt,userId:msg.author.id,channelId:msg.channel.id,message:text,fireAt});
    const c=mc(0x57f287); c.addTextDisplayComponents(tx("## ⏰ Reminder Set\n**Message:** "+text+"\n**Fires:** <t:"+Math.floor(fireAt/1000)+":R>\n**Duration:** "+fmtDur(ms))); return send(msg.channel,c);
  }
  const c=mc(0x57f287); c.addTextDisplayComponents(tx("## ⏰ Set Reminder\nClick below to set your reminder."));
  msg.channel.send({components:[c,modalBtn("openmodal:remind:"+msg.author.id+":"+msg.channel.id,"Set Reminder")],flags:F,allowedMentions:{parse:[]}});
});

reg("Reminders","reminders",["myreminders","rlist"],"List your active reminders",".reminders", async (msg) => {
  const myR=reminders.filter(r=>r.userId===msg.author.id);
  if(!myR.length) return _sendErr(msg.channel,"You have no active reminders.");
  paginate(msg.channel,msg.author.id,myR,10,(r,i)=>"**"+(i+1)+".** "+r.message+"\n  -# Fires <t:"+Math.floor(r.fireAt/1000)+":R>","⏰ Your Reminders");
});

reg("Voice","join",["connect","j"],"Join your voice channel",".join", async (msg) => {
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  try {
    let p=kazagumo.players.get(msg.guild.id);
    if(!p){p=await kazagumo.createPlayer({guildId:msg.guild.id,textId:msg.channel.id,voiceId:msg.member.voice.channel.id,volume:80,deaf:true});p.data.set("channel",msg.channel);}
    _sendOk(msg.channel,"## 🔊 Joined\nConnected to **"+msg.member.voice.channel.name+"**.");
  } catch { _sendErr(msg.channel,"Could not join the voice channel."); }
});

reg("Voice","disconnect",["leave2","lv"],"Leave the voice channel",".disconnect", async (msg) => {
  const p=kazagumo.players.get(msg.guild.id); if(!p) return _sendErr(msg.channel,"Not in a voice channel.");
  p.destroy(); _sendOk(msg.channel,"## 🔇 Disconnected\nLeft the voice channel.");
});

reg("Voice","movehere",["moveme","mh"],"Move the bot to your voice channel",".movehere", async (msg) => {
  if(!msg.member.voice.channel) return _sendErr(msg.channel,"You need to be in a voice channel.");
  const p=kazagumo.players.get(msg.guild.id); if(!p) return _sendErr(msg.channel,"Bot is not in a voice channel.");
  await p.setVoiceChannel(msg.member.voice.channel.id); _sendOk(msg.channel,"## 🔊 Moved\nMoved to **"+msg.member.voice.channel.name+"**.");
});

reg("Moderation","kick",["k"],"Kick a member",".kick @user [reason]", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.KickMembers)) return _sendErr(msg.channel,"Missing KickMembers permission.");
  const target=msg.mentions?.members?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"kick @user [reason]");
  if(!target.kickable) return _sendErr(msg.channel,"I cannot kick that member.");
  const reason=args.slice(1).join(" ")||"No reason provided";
  await target.kick(reason); _sendOk(msg.channel,"## ✅ Kicked\n**"+target.user.tag+"** — "+reason);
});

reg("Moderation","ban",["b"],"Ban a member",".ban @user [reason]", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.BanMembers)) return _sendErr(msg.channel,"Missing BanMembers permission.");
  const target=msg.mentions?.members?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"ban @user [reason]");
  if(!target.bannable) return _sendErr(msg.channel,"I cannot ban that member.");
  const reason=args.slice(1).join(" ")||"No reason provided";
  confirm(msg,"Ban **"+target.user.tag+"**?\nReason: "+reason, async()=>{await target.ban({reason});_sendOk(msg.channel,"## ✅ Banned\n**"+target.user.tag+"** — "+reason);});
});

reg("Moderation","unban",["ub"],"Unban a user by ID",".unban <userID>", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.BanMembers)) return _sendErr(msg.channel,"Missing BanMembers permission.");
  if(!args[0]) return _sendErr(msg.channel,"Usage: "+PREFIX+"unban <userID>");
  try{await msg.guild.members.unban(args[0],args.slice(1).join(" ")||"Unbanned by "+msg.author.tag);_sendOk(msg.channel,"## ✅ Unbanned\nUser **"+args[0]+"** has been unbanned.");}
  catch{_sendErr(msg.channel,"Could not unban. Make sure the ID is correct.");}
});

reg("Moderation","mute",["timeout","to"],"Timeout a member",".mute @user <time> [reason]", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ModerateMembers)) return _sendErr(msg.channel,"Missing ModerateMembers permission.");
  const target=msg.mentions?.members?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"mute @user 10m [reason]");
  const ms=parseTime(args[1]); if(!ms) return _sendErr(msg.channel,"Invalid duration. Use 10m, 1h, etc.");
  const reason=args.slice(2).join(" ")||"No reason provided";
  await target.timeout(ms,reason); _sendOk(msg.channel,"## ✅ Timed Out\n**"+target.user.tag+"** — "+fmtDur(ms)+"\nReason: "+reason);
});

reg("Moderation","unmute",["untimeout","unto"],"Remove a member's timeout",".unmute @user", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ModerateMembers)) return _sendErr(msg.channel,"Missing ModerateMembers permission.");
  const target=msg.mentions?.members?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"unmute @user");
  await target.timeout(null); _sendOk(msg.channel,"## ✅ Timeout Removed\n**"+target.user.tag+"** can now speak again.");
});

reg("Moderation","purge",["clear","bulkdelete","prune"],"Delete multiple messages",".purge <amount>",
  cmd=>cmd.addIntegerOption(o=>o.setName("amount").setDescription("Number of messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)),
  async (msg,args) => {
    if(!hasPerm(msg.member,PermissionFlagsBits.ManageMessages)) return _sendErr(msg.channel,"Missing ManageMessages permission.");
    const amount=parseInt(msg._interaction?.options?.getInteger("amount")??args[0]);
    if(isNaN(amount)||amount<1||amount>100) return _sendErr(msg.channel,"Usage: "+PREFIX+"purge <1-100>");
    const deleted=await msg.channel.bulkDelete(amount+1,true).catch(()=>null);
    if(!deleted) return _sendErr(msg.channel,"Could not delete messages. They may be too old.");
    const n=deleted.size-1;
    const m=await _sendOk(msg.channel,"## ✅ Purged\nDeleted **"+n+"** message"+(n!==1?"s":"")+".");
    if(m) setTimeout(()=>m.delete().catch(()=>{}),4000);
  });

reg("Moderation","slowmode",["sm","slow"],"Set slowmode on a channel",".slowmode <seconds>",
  cmd=>cmd.addIntegerOption(o=>o.setName("seconds").setDescription("Slowmode duration in seconds (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(21600)),
  async (msg,args) => {
    if(!hasPerm(msg.member,PermissionFlagsBits.ManageChannels)) return _sendErr(msg.channel,"Missing ManageChannels permission.");
    const secs=parseInt(msg._interaction?.options?.getInteger("seconds")??args[0]);
    if(isNaN(secs)||secs<0||secs>21600) return _sendErr(msg.channel,"Usage: "+PREFIX+"slowmode <0-21600>");
    await msg.channel.setRateLimitPerUser(secs); _sendOk(msg.channel,secs===0?"## ✅ Slowmode Disabled":"## ✅ Slowmode Set\n**"+secs+"s** per message.");
  });

reg("Moderation","lock",["lockdown","lk"],"Lock a channel",".lock [#channel]", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageChannels)) return _sendErr(msg.channel,"Missing ManageChannels permission.");
  const ch=msg.mentions?.channels?.first()??msg.channel;
  await ch.permissionOverwrites.edit(msg.guild.roles.everyone,{SendMessages:false}); _sendOk(msg.channel,"## 🔒 Locked\n"+ch+" has been locked.");
});

reg("Moderation","unlock",["unlockdown","ulk"],"Unlock a channel",".unlock [#channel]", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageChannels)) return _sendErr(msg.channel,"Missing ManageChannels permission.");
  const ch=msg.mentions?.channels?.first()??msg.channel;
  await ch.permissionOverwrites.edit(msg.guild.roles.everyone,{SendMessages:null}); _sendOk(msg.channel,"## 🔓 Unlocked\n"+ch+" has been unlocked.");
});

reg("Moderation","nickname",["nick","setnick"],"Change a member's nickname",".nickname @user <nick>", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ManageNicknames)) return _sendErr(msg.channel,"Missing ManageNicknames permission.");
  const target=msg.mentions?.members?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"nickname @user <nick>");
  const nick=args.slice(1).join(" ")||null; await target.setNickname(nick);
  _sendOk(msg.channel,"## ✅ Nickname "+(nick?"Set\n**"+target.user.tag+"** → "+nick:"Cleared\n**"+target.user.tag+"**"));
});

reg("Moderation","warn",["w2","warning"],"Warn a member (DM)",".warn @user [reason]", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.ModerateMembers)) return _sendErr(msg.channel,"Missing ModerateMembers permission.");
  const target=msg.mentions?.users?.first(); if(!target) return _sendErr(msg.channel,"Usage: "+PREFIX+"warn @user [reason]");
  const reason=args.slice(1).join(" ")||"No reason provided";
  try{const dm=mc(0xfee75c);dm.addTextDisplayComponents(tx("## ⚠️ Warning\nYou have been warned in **"+msg.guild.name+"**\n**Reason:** "+reason+"\n-# Warned by "+msg.author.tag));await target.send({components:[dm],flags:F});}catch{}
  _sendOk(msg.channel,"## ✅ Warned\n**"+target.tag+"** — "+reason);
});

reg("Moderation","bans",["banlist","listbans"],"List banned users",".bans", async (msg) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.BanMembers)) return _sendErr(msg.channel,"Missing BanMembers permission.");
  const bans=await msg.guild.bans.fetch(); if(!bans.size) return _sendErr(msg.channel,"No banned users.");
  paginate(msg.channel,msg.author.id,[...bans.values()],10,b=>"**"+b.user.tag+"** — "+(b.reason??"No reason"),"🔨 Banned Users ("+bans.size+")");
});

reg("Moderation","softban",["sb2"],"Ban then unban to clear messages",".softban @user [reason]", async (msg,args) => {
  if(!hasPerm(msg.member,PermissionFlagsBits.BanMembers)) return _sendErr(msg.channel,"Missing BanMembers permission.");
  const target=msg.mentions?.members?.first(); if(!target||!target.bannable) return _sendErr(msg.channel,"Usage: "+PREFIX+"softban @user [reason]");
  const reason=args.slice(1).join(" ")||"Softban";
  await target.ban({deleteMessageSeconds:604800,reason}); await msg.guild.members.unban(target.id,"Softban unban");
  _sendOk(msg.channel,"## ✅ Softbanned\n**"+target.user.tag+"** — messages cleared.");
});

setInterval(() => {
  const now=Date.now();
  for(let i=reminders.length-1;i>=0;i--){
    const r=reminders[i];
    if(now>=r.fireAt){
      const ch=client.channels.cache.get(r.channelId);
      if(ch){const c=mc(0x57f287);c.addTextDisplayComponents(tx("## ⏰ Reminder\n<@"+r.userId+">, you asked me to remind you:\n\n**"+r.message+"**"));ch.send({components:[c],flags:F,allowedMentions:{parse:["users"]}});}
      reminders.splice(i,1);
    }
  }
},10000);

client.on("messageDelete", (msg) => {
  if(msg.author?.bot) return;
  snipeStore.set(msg.channel.id,{author:msg.author?.tag??"Unknown",content:msg.content,at:Date.now()});
});
client.on("messageUpdate", (oldMsg,newMsg) => {
  if(oldMsg.author?.bot||oldMsg.content===newMsg.content) return;
  esnipeStore.set(oldMsg.channel.id,{author:oldMsg.author?.tag??"Unknown",before:oldMsg.content,after:newMsg.content,at:Date.now()});
});

client.on("messageCreate", async (msg) => {
  if(msg.author.bot||!msg.guild) return;

  if(afkStore.has(msg.author.id)){
    afkStore.delete(msg.author.id);
    const c=mc(0x57f287); c.addTextDisplayComponents(tx("## 👋 Welcome Back!\nYour AFK status has been removed."));
    msg.channel.send({components:[c],flags:F,allowedMentions:{parse:[]}}).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));
  }

  for(const [id,data] of afkStore){
    if(msg.mentions.users.has(id)){
      const c=mc(0xfee75c); c.addTextDisplayComponents(tx("💤 <@"+id+"> is AFK: **"+data.reason+"** ("+fmtDur(Date.now()-data.since)+" ago)"));
      msg.channel.send({components:[c],flags:F,allowedMentions:{parse:[]}});
    }
  }

  if(!msg.content.startsWith(PREFIX)) return;

  const args=msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const invoked=args.shift().toLowerCase();
  const cmd=registry.get(invoked); if(!cmd) return;

  const cd=cooldown(msg.author.id,cmd.name);
  if(cd) return sendErr(msg.channel,"Cooldown! Wait **"+cd+"s**.");

  try { await cmd.run(msg,args,invoked); }
  catch(e) { console.error("[CMD:"+cmd.name+"]",e); sendErr(msg.channel,"An error occurred running that command."); }
});

client.on("interactionCreate", async (interaction) => {

  if(interaction.isChatInputCommand()){

    if(["play","skip","stop","pause","resume","nowplaying","queue","volume","loop","shuffle","seek","remove","skipto","clearqueue","lyrics","spotify","join","disconnect","movehere"].includes(interaction.commandName)){
      return handleMusicSlash(interaction);
    }

    return dispatchSlash(interaction);
  }

  if(interaction.isButton()){
    const id=interaction.customId;

    if(id.startsWith("pg:")){
      const parts=id.split(":"), dir=parts[1], pgId=parts.slice(2,-1).join(":"), page=parseInt(parts[parts.length-1]);
      await interaction.deferUpdate();
      return renderPage(interaction.channel,pgId,dir==="next"?page+1:page-1,interaction.message);
    }

    if(id.startsWith("confirm:")||id.startsWith("cancel:")){
      const key=id.slice(id.indexOf(":")+1), data=pendingConfirm.get(key);
      if(!data) return interaction.reply(eph((()=>{const c=mc(0xed4245);c.addTextDisplayComponents(tx("❌  This confirmation has expired."));return c;})()));
      if(data.uid!==interaction.user.id) return interaction.reply(eph((()=>{const c=mc(0xed4245);c.addTextDisplayComponents(tx("❌  This is not your confirmation."));return c;})()));
      pendingConfirm.delete(key);
      if(id.startsWith("cancel:")){ await interaction.update({components:[],flags:F}); return; }
      await interaction.deferUpdate(); return data.fn();
    }

    if(id.startsWith("openmodal:")){
      const key=id.slice("openmodal:".length), [type,uid,extra]=key.split(":");
      if(type==="say")     return interaction.showModal(buildModal("modal:say:"+uid+":"+extra,"Say Something",input("content","Message",TextInputStyle.Paragraph,{placeholder:"Type your message here...",max:2000})));
      if(type==="announce")return interaction.showModal(buildModal("modal:announce:"+uid+":"+extra,"Announcement",input("content","Announcement",TextInputStyle.Paragraph,{placeholder:"Write your announcement...",max:4000})));
      if(type==="poll")    return interaction.showModal(buildModal("modal:poll:"+uid+":"+extra,"Create Poll",input("question","Poll Question",TextInputStyle.Short,{placeholder:"What is your question?",max:256})));
      if(type==="note")    return interaction.showModal(buildModal("modal:note:"+uid,"Add Note",input("text","Note",TextInputStyle.Paragraph,{placeholder:"Write your note...",max:1000})));
      if(type==="tag")     return interaction.showModal(buildModal("modal:tag:"+uid+":"+extra,"Set Tag: "+extra,input("text","Tag Content",TextInputStyle.Paragraph,{placeholder:"Write the tag content...",max:2000})));
      if(type==="afk")     return interaction.showModal(buildModal("modal:afk:"+uid,"Set AFK Reason",input("reason","Reason",TextInputStyle.Short,{placeholder:"Why are you going AFK?",max:200})));
      if(type==="remind")  return interaction.showModal(buildModal("modal:remind:"+uid+":"+extra,"Set Reminder",input("duration","Duration",TextInputStyle.Short,{placeholder:"e.g. 10m, 2h, 1d"}),input("message","Reminder Message",TextInputStyle.Short,{placeholder:"What should I remind you about?"})));
      return;
    }

    if(id.startsWith("music:")){
      const action=id.slice("music:".length);
      const player=kazagumo.players.get(interaction.guild.id);
      if(action==="stop"){
        if(!player) return interaction.reply(ephErr("Nothing is playing right now."));
        player.destroy(); return interaction.reply(ephOk("## ⏹️ Stopped\nQueue cleared and left the voice channel."));
      }
      if(!player?.queue?.current) return interaction.reply(ephErr("Nothing is playing right now."));
      if(action==="playpause"){
        if(player.paused){player.pause(false);}else{player.pause(true);}
        await refreshNP(player); return interaction.reply(ephOk(player.paused?"## ⏸️ Paused":"## ▶️ Resumed"));
      }
      if(action==="skip"){const title=player.queue.current.title;player.skip();return interaction.reply(ephOk("## ⏭️ Skipped\n**"+title+"**"));}
      if(action==="shuffle"){if(player.queue.length<2)return interaction.reply(ephErr("Not enough tracks to shuffle."));player.queue.shuffle();return interaction.reply(ephOk("## 🔀 Shuffled!"));}
      if(action==="loop"){
        const modes=["none","track","queue"], labels={none:"🔄 Off",track:"🔂 Track",queue:"🔁 Queue"};
        const next=modes[(modes.indexOf(player.loop??"none")+1)%modes.length];
        player.setLoop(next); await refreshNP(player); return interaction.reply(ephOk("## 🔁 Loop → **"+labels[next]+"**"));
      }
      if(action==="voldown"){const vol=Math.max(10,player.volume-10);player.setVolume(vol);await refreshNP(player);return interaction.reply(ephOk("## 🔉 Volume → **"+vol+"%**"));}
      if(action==="volup"){const vol=Math.min(100,player.volume+10);player.setVolume(vol);await refreshNP(player);return interaction.reply(ephOk("## 🔊 Volume → **"+vol+"%**"));}
      if(action==="clearqueue"){player.queue.splice(0,player.queue.length);await refreshNP(player);return interaction.reply(ephOk("## 🗑️ Queue Cleared"));}
      if(action==="prev") return interaction.reply(ephErr("Previous track is not supported in this setup."));
      return;
    }
    return;
  }

  if(interaction.isStringSelectMenu()){
    if(interaction.customId==="help:cat"){
      const cat=CATEGORIES.find(c=>c.name===interaction.values[0]);
      if(!cat) return interaction.reply(ephErr("Category not found."));
      const {container,row}=buildHelpCat(cat);
      return interaction.update({components:[container,row],flags:F,allowedMentions:{parse:[]}});
    }
    return;
  }

  if(interaction.isModalSubmit()){
    const id=interaction.customId;
    if(id.startsWith("modal:say:")){const content=interaction.fields.getTextInputValue("content");await interaction.deferUpdate().catch(()=>{});interaction.channel.send({content,allowedMentions:{parse:[]}});return;}
    if(id.startsWith("modal:announce:")){const parts=id.split(":"),chanId=parts[3],content=interaction.fields.getTextInputValue("content"),ch=interaction.guild.channels.cache.get(chanId);if(!ch)return interaction.reply(ephErr("Channel not found."));await interaction.deferUpdate().catch(()=>{});ch.send({content,allowedMentions:{parse:[]}});return;}
    if(id.startsWith("modal:poll:")){const question=interaction.fields.getTextInputValue("question");await interaction.deferUpdate().catch(()=>{});const c=mc(0xfee75c);c.addTextDisplayComponents(tx("## 📊 Poll\n"+question+"\n\n-# Asked by "+interaction.user.username));const m=await interaction.channel.send({components:[c],flags:F,allowedMentions:{parse:[]}});await m.react("✅").catch(()=>{});await m.react("❌").catch(()=>{});return;}
    if(id.startsWith("modal:note:")){const text=interaction.fields.getTextInputValue("text"),uid=interaction.user.id,list=notes.get(uid)??[];list.push({text,at:Date.now()});notes.set(uid,list);return interaction.reply(ephOk("## ✅ Note Saved\n"+text));}
    if(id.startsWith("modal:tag:")){const parts=id.split(":"),name=parts[3],text=interaction.fields.getTextInputValue("text");tags.set(name,{text,author:interaction.user.username,at:Date.now()});return interaction.reply(ephOk("## ✅ Tag Saved\n**"+name+"** has been set."));}
    if(id.startsWith("modal:afk:")){const reason=interaction.fields.getTextInputValue("reason");afkStore.set(interaction.user.id,{reason,since:Date.now()});return interaction.reply(eph((()=>{const c=mc(0xfee75c);c.addTextDisplayComponents(tx("## 💤 AFK Set\n**Reason:** "+reason));return c;})()));}
    if(id.startsWith("modal:remind:")){
      const duration=interaction.fields.getTextInputValue("duration"),message=interaction.fields.getTextInputValue("message"),ms=parseTime(duration);
      if(!ms) return interaction.reply(ephErr("Invalid duration. Use 10m, 2h, 1d etc."));
      const fireAt=Date.now()+ms;
      reminders.push({id:interaction.user.id+"-"+fireAt,userId:interaction.user.id,channelId:interaction.channel.id,message,fireAt});
      return interaction.reply(ephOk("## ⏰ Reminder Set\n**Message:** "+message+"\n**Fires:** <t:"+Math.floor(fireAt/1000)+":R>"));
    }
    return;
  }
});

async function handleMusicSlash(interaction) {
  const name=interaction.commandName;
  const ok  =(m)=>interaction.editReply(ephOk(m)).catch(()=>{});
  const err =(m)=>interaction.editReply(ephErr(m)).catch(()=>{});

  if(name==="play"){
    await interaction.deferReply({ephemeral:false});
    const query=interaction.options.getString("query"), vc=interaction.member.voice?.channel;
    if(!vc) return err("You need to be in a voice channel.");
    let player=kazagumo.players.get(interaction.guild.id);
    if(!player){player=await kazagumo.createPlayer({guildId:interaction.guild.id,textId:interaction.channel.id,voiceId:vc.id,volume:80,deaf:true});player.data.set("channel",interaction.channel);}
    const res=await kazagumo.search(query,{requester:interaction.user}).catch(()=>null);
    if(!res?.tracks?.length) return err("No results found for **"+query+"**.");
    if(res.type==="PLAYLIST"){for(const t of res.tracks)player.queue.add(t);const c=mc(0x1db954);c.addTextDisplayComponents(tx("## ✅ Playlist Added\n**"+res.playlistName+"** — "+res.tracks.length+" tracks\n-# Requested by "+interaction.user.username));interaction.editReply({components:[c],flags:F,allowedMentions:{parse:[]}});}
    else{player.queue.add(res.tracks[0]);const c=mc(0x1db954);c.addTextDisplayComponents(tx("## ✅ Added to Queue\n**"+res.tracks[0].title+"**\n"+(res.tracks[0].author??"")+"\n-# Requested by "+interaction.user.username));interaction.editReply({components:[c],flags:F,allowedMentions:{parse:[]}});}
    if(!player.playing&&!player.paused) player.play();
    return;
  }

  await interaction.deferReply({ephemeral:true});
  const player=kazagumo.players.get(interaction.guild.id);
  const needPlayer=!["join","disconnect","movehere","stop"].includes(name);
  if(needPlayer&&!player?.queue?.current) return err("Nothing is playing right now.");
  if(!["stop","join","disconnect","movehere"].includes(name)&&!interaction.member.voice?.channel) return err("You need to be in a voice channel.");

  if(name==="stop"){if(!player)return err("Nothing is playing right now.");player.destroy();return ok("## ⏹️ Stopped\nQueue cleared and left the voice channel.");}
  if(name==="join"){const vc=interaction.member.voice?.channel;if(!vc)return err("You need to be in a voice channel.");if(!kazagumo.players.get(interaction.guild.id)){const p=await kazagumo.createPlayer({guildId:interaction.guild.id,textId:interaction.channel.id,voiceId:vc.id,volume:80,deaf:true});p.data.set("channel",interaction.channel);}return ok("## 🔊 Joined **"+vc.name+"**.");}
  if(name==="disconnect"){if(!player)return err("Not in a voice channel.");player.destroy();return ok("## 🔇 Disconnected.");}
  if(name==="movehere"){const vc=interaction.member.voice?.channel;if(!vc)return err("You need to be in a voice channel.");if(!player)return err("Not in a voice channel.");await player.setVoiceChannel(vc.id);return ok("## 🔊 Moved to **"+vc.name+"**.");}
  if(name==="skip"){const title=player.queue.current.title;player.skip();return ok("## ⏭️ Skipped\n**"+title+"**");}
  if(name==="pause"){if(player.paused)return err("Already paused. Use /resume.");player.pause(true);await refreshNP(player);return ok("## ⏸️ Paused");}
  if(name==="resume"){if(!player.paused)return err("Not paused. Use /pause.");player.pause(false);await refreshNP(player);return ok("## ▶️ Resumed");}
  if(name==="nowplaying"){
    const track=player.queue.current,loopMap={none:"🔄 Off",track:"🔂 Track",queue:"🔁 Queue"};
    const pos=player.position,total=track.length,filled=Math.min(Math.round((pos/total)*15),15);
    const bar="▬".repeat(filled)+"🔘"+"▬".repeat(15-filled);
    const c=mc(0x1db954);c.addTextDisplayComponents(tx("## 🎵 Now Playing\n**"+track.title+"**\n"+(track.author??"")+"  ·  "+msToTime(total)));c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx(bar+"  "+msToTime(pos)+" / "+msToTime(total)+"\n\n**Volume:** "+player.volume+"%  ·  **Loop:** "+(loopMap[player.loop]??"Off")+"\n-# Requested by "+(track.requester?.username??"Unknown")));
    return interaction.editReply({components:[c],flags:F|MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  }
  if(name==="queue"){
    const tracks=[...player.queue],current=player.queue.current;
    const page=(interaction.options.getInteger("page")??1)-1,slice=tracks.slice(page*10,(page+1)*10);
    const c=mc(0x1db954);c.addTextDisplayComponents(tx("## 🎶 Queue  ·  "+(tracks.length+1)+" track(s)"));c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**▶ Now:** "+current.title+"  ·  "+msToTime(current.length)));
    if(slice.length){c.addSeparatorComponents(sp());c.addTextDisplayComponents(tx(slice.map((t,i)=>"**"+(page*10+i+1)+".** "+t.title+"  ·  "+msToTime(t.length)).join("\n")));}
    return interaction.editReply({components:[c],flags:F|MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  }
  if(name==="volume"){const vol=interaction.options.getInteger("level");player.setVolume(vol);await refreshNP(player);return ok("## 🔊 Volume → **"+vol+"%**");}
  if(name==="loop"){const mode=interaction.options.getString("mode"),labels={none:"🔄 Off",track:"🔂 Track",queue:"🔁 Queue"};player.setLoop(mode);await refreshNP(player);return ok("## 🔁 Loop → **"+labels[mode]+"**");}
  if(name==="shuffle"){if(player.queue.length<2)return err("Not enough tracks to shuffle.");player.queue.shuffle();return ok("## 🔀 Queue shuffled!");}
  if(name==="seek"){const raw=interaction.options.getString("time"),parts=raw.split(":").map(Number).reverse(),ms=((parts[2]||0)*3600+(parts[1]||0)*60+(parts[0]||0))*1000;if(!ms)return err("Invalid time format. Use `1:30` or `90`.");await player.seek(ms);return ok("## ⏩ Seeked to **"+raw+"**");}
  if(name==="remove"){const pos=interaction.options.getInteger("position")-1,queue=[...player.queue];if(pos<0||pos>=queue.length)return err("Invalid position.");const title=queue[pos].title;player.queue.splice(pos,1);return ok("## 🗑️ Removed\n**"+title+"**");}
  if(name==="skipto"){const pos=interaction.options.getInteger("position")-1;if(pos<0||pos>=player.queue.length)return err("Invalid position.");player.queue.splice(0,pos);player.skip();return ok("## ⏭️ Jumped to track **"+(pos+1)+"**");}
  if(name==="clearqueue"){player.queue.splice(0,player.queue.length);await refreshNP(player);return ok("## 🗑️ Queue cleared.");}
  if(name==="lyrics"){
    const artist=interaction.options.getString("artist"),title=interaction.options.getString("title");
    let data;try{data=await fetchJSON("https://api.lyrics.ovh/v1/"+encodeURIComponent(artist)+"/"+encodeURIComponent(title));}catch{return err("Could not reach the lyrics API.");}
    if(data.error||!data.lyrics)return err("No lyrics found for **"+title+"** by **"+artist+"**.");
    const raw=data.lyrics.replace(/\r\n/g,"\n").trim();
    const c=mc(0x5865f2);c.addTextDisplayComponents(tx("## 🎵 "+title+"\n-# "+artist));c.addSeparatorComponents(sp());c.addTextDisplayComponents(tx(raw.slice(0,3800)+(raw.length>3800?"\n\n-# (truncated)":"")));
    return interaction.editReply({components:[c],flags:F|MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  }
  if(name==="spotify"){
    const target=interaction.options.getMember("user")??interaction.member;
    const act=target.presence?.activities.find(a=>a.name==="Spotify"&&a.type===ActivityType.Listening);
    if(!act)return err("**"+target.user.username+"** is not listening to Spotify right now.");
    const c=mc(0x1db954);c.addTextDisplayComponents(tx("## 🎧 Spotify — "+target.user.username));c.addSeparatorComponents(sp());
    c.addTextDisplayComponents(tx("**Track:** "+(act.details??"Unknown")+"\n**Artist:** "+(act.state??"Unknown")+"\n**Album:** "+(act.assets?.largeText??"Unknown")));
    return interaction.editReply({components:[c],flags:F|MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  }
}

client.once("clientReady", async () => {
  console.log("[READY] Logged in as " + client.user.tag);
  client.user.setActivity("Made By: @4zcy", { type: ActivityType.Custom });

  const MUSIC_NAMES = new Set(["play","skip","stop","pause","resume","nowplaying","queue","volume","loop","shuffle","seek","remove","skipto","clearqueue","lyrics","spotify","join","disconnect","movehere"]);

  const seen = new Set();
  const prefixSlash = [];
  for(const def of registry.values()){
    if(seen.has(def.name)) continue;
    if(MUSIC_NAMES.has(def.name)) continue;
    seen.add(def.name);
    let b = new SlashCommandBuilder().setName(def.name).setDescription(def.desc.slice(0,100));
    if(def.slashFn) b = def.slashFn(b) ?? b;
    prefixSlash.push(b.toJSON());
  }

  const musicSlash = [
    new SlashCommandBuilder().setName("play").setDescription("Play a song or add it to the queue").addStringOption(o=>o.setName("query").setDescription("Song name or URL").setRequired(true)),
    new SlashCommandBuilder().setName("skip").setDescription("Skip the current track"),
    new SlashCommandBuilder().setName("stop").setDescription("Stop music and disconnect"),
    new SlashCommandBuilder().setName("pause").setDescription("Pause the current track"),
    new SlashCommandBuilder().setName("resume").setDescription("Resume the paused track"),
    new SlashCommandBuilder().setName("nowplaying").setDescription("Show the currently playing track"),
    new SlashCommandBuilder().setName("queue").setDescription("Show the current queue").addIntegerOption(o=>o.setName("page").setDescription("Page number").setRequired(false).setMinValue(1)),
    new SlashCommandBuilder().setName("volume").setDescription("Set the playback volume").addIntegerOption(o=>o.setName("level").setDescription("Volume 1-100").setRequired(true).setMinValue(1).setMaxValue(100)),
    new SlashCommandBuilder().setName("loop").setDescription("Set loop mode").addStringOption(o=>o.setName("mode").setDescription("Loop mode").setRequired(true).addChoices({name:"Off",value:"none"},{name:"Track",value:"track"},{name:"Queue",value:"queue"})),
    new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue"),
    new SlashCommandBuilder().setName("seek").setDescription("Seek to a position in the track").addStringOption(o=>o.setName("time").setDescription("Timestamp e.g. 1:30").setRequired(true)),
    new SlashCommandBuilder().setName("remove").setDescription("Remove a track from the queue").addIntegerOption(o=>o.setName("position").setDescription("Queue position").setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName("skipto").setDescription("Jump to a track in the queue").addIntegerOption(o=>o.setName("position").setDescription("Queue position").setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName("clearqueue").setDescription("Clear all upcoming tracks"),
    new SlashCommandBuilder().setName("lyrics").setDescription("Get song lyrics").addStringOption(o=>o.setName("artist").setDescription("Artist name").setRequired(true)).addStringOption(o=>o.setName("title").setDescription("Song title").setRequired(true)),
    new SlashCommandBuilder().setName("spotify").setDescription("Show what someone is listening to on Spotify").addUserOption(o=>o.setName("user").setDescription("User to check").setRequired(false)),
    new SlashCommandBuilder().setName("join").setDescription("Join your voice channel"),
    new SlashCommandBuilder().setName("disconnect").setDescription("Disconnect from the voice channel"),
    new SlashCommandBuilder().setName("movehere").setDescription("Move the bot to your voice channel"),
  ].map(c=>c.toJSON());

  const all = [...musicSlash, ...prefixSlash];

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: all });
    console.log("[SLASH] Registered " + all.length + " slash commands (" + musicSlash.length + " music + " + prefixSlash.length + " general).");
  } catch(e) {
    console.error("[SLASH] Failed to register commands:", e);
  }
});

client.login(TOKEN);
