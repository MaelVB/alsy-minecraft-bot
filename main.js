import { Client } from 'discord.js';
const client = new Client();
import { CronJob } from 'cron';
import got from 'got';
import editJsonFile from "edit-json-file";

const DISCORD_MESSAGE_LIMIT = 2000;
const prefix = "!";

const configPath = './data/config.json'
const config = await import(configPath);

const statsChanId = config.default.discordStatsChanId;
const statsMessageId = config.default.discordStatsMessageId;

const changePlayersChan = new CronJob('10 0-55/5 * * * *', async function() {
    const players = await updateStats();
    const d = new Date();
    console.log('Players Update : ' + players + ' à ' + d);
});

const updateStats = async () => {
    const brutStats = await fetchStats()

    const players = await currentPlayersStats(brutStats);
    client.channels.cache.find(ch => ch.id === statsChanId).setName(players);

    const allStats = await stats(brutStats);
    client.channels.cache.find(ch => ch.id === statsChanId).messages.fetch(statsMessageId).then(message => message.edit(allStats)).catch(console.error);

    return players;
}

const fetchStats = async () => {
    const brutStatusStats = await got('https://mcapi.us/server/status?ip=' + config.default.minecraftServerUrl).json();
    const brutQueryStats = await got('https://mcapi.us/server/query?ip=' + config.default.minecraftServerUrl).json();
    brutQueryStats.server = brutStatusStats.server;
    return brutQueryStats;
}

const stats = async (brutStats) => {
    if(brutStats.online) {
        let players = "\n";
        if (brutStats.players.now > 0) {
            players = players + await playersStats();
        }
        const d = new Date();
        const hour = d.getHours();
        const min = d.getMinutes();
        const time = hour + ":" + (min < 10 ? '0' : '') + min
        let stats = '[' + time + ']\nServeur **EN LIGNE**' + "\nVersion : " + brutStats.server.name + "\nJoueurs : " + brutStats.players.now + "/" + brutStats.players.max
        let pluginsNames = brutStats.plugins.join('\n');
        stats = stats + players + '\n\nPlugins : \n`' + pluginsNames + '`'
        return stats;
    } else {
        return 'Serveur **ETEINT**';
    }
}

const playersStats = async () => {
    const dynmapPlayersStats = await dynmapStats();
    let players = "";
    let playersInfos;
    dynmapPlayersStats.players.forEach(elmt => {
        if(elmt.world == 'world') {
            playersInfos =  '`(x: ' + elmt.x + ', y: ' + elmt.y + ', z: ' + elmt.z + ')' + ' [health: ' + elmt.health + ', armor: ' + elmt.armor + ']`'
        } else {
            playersInfos = ' `[Dans le Nether ou l\'End]`'
        }
        players = players + '\n**' + elmt.name + '**' + playersInfos;
    });
    if(players === "") players = "Il n'y a aucun joueur actuellement connecté."
    return players;
}

const currentPlayersStats = async (brutStats) => {
    const stats = brutStats.players.now + " sur " + brutStats.players.max
    return stats;
}

const dynmapStats = async () => {
    let brutStats = await got(config.default.dynmapUrl).json();
    return brutStats;
}

// EVENTS

client.on("ready", async function () {
    console.log("Ratuscraft Bot launched !");
    /*if(config.default.cronIsActive) {
        changePlayersChan.start();
    }*/
})

client.on("message", async (message) => {
    try {
        if (message.author.bot) return;
        if (!message.content.startsWith(prefix)) return;

        const commandBody = message.content.slice(prefix.length);
        const args = commandBody.split(' ');
        const command = args.shift().toLowerCase();

        let brutStats = ""

        // Role admin requis
        if (message.member.roles.cache.some(r => r.name === "Organisateur") || message.member.roles.cache.some(r => r.name === "Le role des modos du bot")) {
            switch (command) {
                // Utile
                case 'init':
                    try {
                        if(config.default.init) {
                            const configFile = editJsonFile(`data/${configPath}`);

                            if(config.default.createRulesChan) {
                                const createRulesChan = await message.guild.channels.create('règles');
                                configFile.set("discordRulesChanId", createRulesChan.id);

                                const rulesMessageFile = require('./rulesMessage.json');
                                const textRulesMessage1 = await message.guild.channels.cache.find(ch => ch.id === createRulesChan.id).send(rulesMessageFile.rulesMessage1);
                                const textRulesMessage2 = await message.guild.channels.cache.find(ch => ch.id === createRulesChan.id).send(rulesMessageFile.rulesMessage2);
                                const createRulesMessage = await message.guild.channels.cache.find(ch => ch.id === createRulesChan.id).send(rulesMessageFile.rulesMessage);
                                configFile.set("discordRulesMessageId", createRulesMessage.id);
                            }

                            const createChan = await message.guild.channels.create('PENDING_INFORMATIONS');
                            configFile.set("discordStatsChanId", createChan.id);

                            const createMessage = await message.guild.channels.cache.find(ch => ch.id === createChan.id).send('PENDING_INFORMATIONS');
                            configFile.set("discordStatsMessageId", createMessage.id);

                            configFile.set("init", false);
                            configFile.save();
                            console.log("RESTART YOUR BOT")
                        } else {
                            message.channel.send(`L'initialisation a déjà été effectuée.`);
                        }
                    } catch(err) {
                    console.error(err)
                    }
                    break;
                
                case 'update':
                    await updateStats();
                    break;

                case 'stats':
                    brutStats = await fetchStats()
                    let currentStats = await stats(brutStats);
                    message.channel.send(`${currentStats}`);
                    break;

                case 'pstats':
                    let pStats = await playersStats();
                    message.channel.send(`${pStats}`);
                    break;

                default:
                    message.channel.send("Commande inconnue.");
                    console.log(`${command} : commande inconnue.`);
                }
        } else {
            console.log("Role non accepté");
        }

        // Role admin non requis
        switch (command) {
            // Amusant
            case 'dice':
                const diceRes = Math.floor(Math.random() * 7)
                message.channel.send(`${diceRes}`);
                break;
        }
    } catch (err) {
        console.error(err);
    }
});

client.login(config.default.botToken);