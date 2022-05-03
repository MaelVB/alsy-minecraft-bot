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
    const brutStats = await got('https://api.mcsrvstat.us/2/' + config.default.minecraftServerUrl).json();
    return brutStats;
}

const currentPlayersStats = async (brutStats) => {
    const stats = brutStats.players.online + " sur " + brutStats.players.max
    return stats;
}

const stats = async (brutStats) => {
    if(brutStats.online) {
        let players = "\n";
        if (brutStats.players.online > 0) {
            players = players + " " + await playersStats();
        }
        const d = new Date();
        const hour = d.getHours();
        const min = d.getMinutes();
        const time = hour + ":" + (min < 10 ? '0' : '') + min
        let stats = '[' + time + ']\nServeur **EN LIGNE**' + "\nVersion : " + brutStats.version + " (" + brutStats.software + ")" + "\nJoueurs : " + brutStats.players.online + "/" + brutStats.players.max
        let pluginsNames = brutStats.plugins.raw.join('\n');
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

const dynmapStats = async () => {
    let brutStats = await got(config.default.dynmapUrl).json();
    return brutStats;
}

// EVENTS

client.on("ready", async function () {
    console.log("Alsy Minecraft Bot launched !");
    if(config.default.cronIsActive) {
        changePlayersChan.start();
    }
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
        if (message.member.roles.cache.some(r => r.name === "Modérateurs") || message.member.roles.cache.some(r => r.name === "Le role des modos du bot")) {
            switch (command) {
                // Utile                
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
    } catch (err) {
        console.error(err);
    }
});

client.login(config.default.botToken);