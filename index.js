const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const http = require('http');
const fs = require('fs');

// --- DATABASE LOCALE SU FILE JSON PER I WARN ---
const WARNS_FILE = './warns.json';
if (!fs.existsSync(WARNS_FILE)) {
    fs.writeFileSync(WARNS_FILE, JSON.stringify({}));
}

function getWarns(userId) {
    const data = JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
    return data[userId] || [];
}

function saveWarn(userId, warnData) {
    const data = JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
    if (!data[userId]) data[userId] = [];
    data[userId].push(warnData);
    fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2));
}

function removeLastWarn(userId) {
    const data = JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
    if (data[userId] && data[userId].length > 0) {
        data[userId].pop();
        fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2));
        return data[userId].length;
    }
    return 0;
}

// --- MINI SERVER WEB PER EVITARE L'ERRORE DI RENDER ---
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot online!');
}).listen(port, () => {
    console.log(`Server web finto attivo sulla porta ${port}`);
});
// ----------------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', async () => {
    console.log(`${client.user.tag} è online e pronto a moderare!`);
    
    try {
        if (client.user.username !== config.botName) {
            await client.user.setUsername(config.botName);
        }
        if (config.botAvatar && config.botAvatar.startsWith('http')) {
            await client.user.setAvatar(config.botAvatar);
        }
    } catch (error) {
        console.error("Limite cambio profilo Discord raggiunto:", error.message);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- FILTRO AUTOMOD (BLOCCO PAROLACCE) ---
    const messageContentLower = message.content.toLowerCase();
    const hasBadWord = config.badWords.some(word => messageContentLower.includes(word));

    if (hasBadWord && message.deletable) {
        await message.delete();
        
        const automodEmbed = new EmbedBuilder()
            .setColor('#FF3333')
            .setTitle('⚠️ Messaggio Censurato')
            .setDescription(`${message.author}, il tuo messaggio conteneva parole bloccate ed è stato rimosso per sicurezza.`)
            .setTimestamp();

        const warning = await message.channel.send({ embeds: [automodEmbed] });
        setTimeout(() => warning.delete().catch(() => {}), 5000);
        return;
    }

    // --- VERIFICA PREFISSO COMANDI ---
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const sendErrorEmbed = (text) => {
        const errEmbed = new EmbedBuilder().setColor('#FF3333').setDescription(`❌ ${text}`);
        return message.reply({ embeds: [errEmbed] });
    };

    // --- COMANDO !help ---
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📚 Lista Comandi - Moderation Bot')
            .setDescription(`Ecco l'elenco dei comandi disponibili nel server. Il prefisso attuale è \`${config.prefix}\`.`)
            .addFields(
                { name: '🛡️ Moderazione (Solo Staff)', value: 
                  `\`${config.prefix}kick @utente [motivo]\` - Espelle un membro dal server.\n` +
                  `\`${config.prefix}ban @utente [motivo]\` - Banna permanentemente un membro.\n` +
                  `\`${config.prefix}unban ID_UTENTE\` - Sblocca un utente precedentemente bannato.\n` +
                  `\`${config.prefix}mute @utente [minuti]\` - Isola temporalmente un utente.\n` +
                  `\`${config.prefix}unmute @utente\` - Rimuove l'isolamento a un utente.\n` +
                  `\`${config.prefix}warn @utente [motivo]\` - Ammonisce ufficialmente un utente.\n` +
                  `\`${config.prefix}unwarn @utente\` - Rimuove l'ultimo ammonimento ricevuto.\n` +
                  `\`${config.prefix}warns @utente\` - Mostra lo storico degli ammonimenti di un utente.\n` +
                  `\`${config.prefix}clear [1-100]\` - Cancella un numero specifico di messaggi.` 
                },
                { name: '⚙️ Automazione', value: 
                  `**AutoMod**: Il bot monitora i messaggi ed elimina all'istante le parole bloccate configurate nel file \`config.json\`.` 
                },
                { name: 'ℹ️ Utilità', value: 
                  `\`${config.prefix}help\` - Mostra questa schermata informativa.` 
                }
            )
            .setFooter({ text: `${config.botName}`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        return message.channel.send({ embeds: [helpEmbed] });
    }
    // --- COMANDO !warn @utente [motivo] ---
    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendErrorEmbed("Non hai i permessi per ammonire gli utenti.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed(`Uso corretto: \`${config.prefix}warn @utente [motivo]\``);
        const reason = args.join(" ") || "Nessun motivo specificato";

        const warnData = { moderator: message.author.tag, reason: reason, date: new Date().toLocaleDateString() };
        saveWarn(target.id, warnData);
        const count = getWarns(target.id).length;

        const warnEmbed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('⚠️ Utente Ammonito (Warn)')
            .addFields(
                { name: 'Utente', value: `${target.user.tag}`, inline: true },
                { name: 'Moderatore', value: `${message.author.tag}`, inline: true },
                { name: 'Totale Warn attuali', value: `\`${count}\``, inline: true },
                { name: 'Motivo', value: reason }
            )
            .setTimestamp();

        message.channel.send({ embeds: [warnEmbed] });
    }

    // --- COMANDO !warns @utente ---
    if (command === 'warns') {
        const target = message.mentions.members.first() || message.member;
        const userWarns = getWarns(target.id);

        if (userWarns.length === 0) {
            const noWarnsEmbed = new EmbedBuilder().setColor('#2ECC71').setDescription(`😇 **${target.user.tag}** non ha nessun ammonimento sul server.`);
            return message.channel.send({ embeds: [noWarnsEmbed] });
        }

        let list = "";
        userWarns.forEach((w, i) => {
            list += `**${i + 1}.** Data: ${w.date} | Mod: ${w.moderator}\n➔ Motivo: *${w.reason}*\n\n`;
        });

        const listEmbed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle(`Storico Warn di ${target.user.username}`)
            .setDescription(list)
            .setTimestamp();

        message.channel.send({ embeds: [listEmbed] });
    }

    // --- COMANDO !unwarn @utente ---
    if (command === 'unwarn') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendErrorEmbed("Non hai i permessi per rimuovere gli ammonimenti.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed(`Uso corretto: \`${config.prefix}unwarn @utente\``);

        const userWarns = getWarns(target.id);
        if (userWarns.length === 0) return sendErrorEmbed("Questo utente non possiede alcun warn da rimuovere.");

        const remaining = removeLastWarn(target.id);

        const unwarnEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setDescription(`✅ Rimosso con successo l'ultimo warn a **${target.user.tag}**. Warn rimanenti: \`${remaining}\`.`);
        
        message.channel.send({ embeds: [unwarnEmbed] });
    }

    // --- COMANDO !unban ID_UTENTE ---
    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendErrorEmbed("Non hai i permessi per sbannare utenti.");
        const targetId = args[0];
        if (!targetId || isNaN(targetId)) return sendErrorEmbed(`Uso corretto: \`${config.prefix}unban ID_UTENTE\``);

        try {
            await message.guild.members.unban(targetId);
            const unbanEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🔓 Utente Sbannato')
                .setDescription(`L'utente con ID \`${targetId}\` è stato rimosso dalla lista dei ban da ${message.author}.`)
                .setTimestamp();
            message.channel.send({ embeds: [unbanEmbed] });
        } catch (error) {
            sendErrorEmbed("Impossibile trovare questo ID nella lista dei ban del server o ID non valido.");
        }
    }

    // --- COMANDO !kick @utente [motivo] ---
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return sendErrorEmbed("Non hai i permessi per cacciare utenti.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed(`Uso corretto: \`${config.prefix}kick @utente [motivo]\``);
        const reason = args.slice(1).join(" ") || "Nessun motivo specificato";
        
        try {
            await target.kick(reason);
            const kickEmbed = new EmbedBuilder()
                .setColor('#E67E22')
                .setTitle('🚫 Utente Espulso')
                .addFields(
                    { name: 'Utente', value: `${target.user.tag}`, inline: true },
                    { name: 'Moderatore', value: `${message.author.tag}`, inline: true },
                    { name: 'Motivo', value: reason }
                )
                .setTimestamp();
            message.channel.send({ embeds: [kickEmbed] });
        } catch (err) {
            sendErrorEmbed("Non ho i permessi per espellere questo utente. Verifica la gerarchia dei ruoli.");
        }
    }

    // --- COMANDO !ban @utente [motivo] ---
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendErrorEmbed("Non hai i permessi per bannare utenti.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed(`Uso corretto: \`${config.prefix}ban @utente [motivo]\``);
        const reason = args.slice(1).join(" ") || "Nessun motivo specificato";
        
        try {
            await target.ban({ reason });
            const banEmbed = new EmbedBuilder()
                .setColor('#992D22')
                .setTitle('❌ Utente Bannato')
                .addFields(
                    { name: 'Utente', value: `${target.user.tag}`, inline: true },
                    { name: 'Moderatore', value: `${message.author.tag}`, inline: true },
                    { name: 'Motivo', value: reason }
                )
                .setTimestamp();
            message.channel.send({ embeds: [banEmbed] });
        } catch (err) {
            sendErrorEmbed("Non ho i permessi per bannare questo utente. Verifica la gerarchia dei ruoli.");
        }
    }

    // --- COMANDO !mute @utente [minuti] ---
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendErrorEmbed("Non hai i permessi per isolare utenti.");
        const target = message.mentions.members.first();
        const duration = parseInt(args[0]); 
        
        if (!target || isNaN(duration)) return sendErrorEmbed(`Uso corretto: \`${config.prefix}mute @utente [minuti]\``);
        
        try {
            await target.timeout(duration * 60 * 1000);
            const muteEmbed = new EmbedBuilder()
                .setColor('#95A5A6')
                .setTitle('🤐 Utente In Muto')
                .addFields(
                    { name: 'Utente', value: `${target.user.tag}`, inline: true },
                    { name: 'Durata', value: `${duration} minuti`, inline: true },
                    { name: 'Moderatore', value: `${message.author.tag}` }
                )
                .setTimestamp();
            message.channel.send({ embeds: [muteEmbed] });
        } catch (err) {
            sendErrorEmbed("Impossibile mutare l'utente. Assicurati che il mio ruolo sia posizionato SOPRA quello dell'utente.");
        }
    }

    // --- COMANDO !unmute @utente ---
    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendErrorEmbed("Non hai i permessi per togliere il muto.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed(`Uso corretto: \`${config.prefix}unmute @utente\``);
        
        try {
            await target.timeout(null);
            const unmuteEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setDescription(`🔊 Il muto a **${target.user.tag}** è stato rimosso con successo.`);
            message.channel.send({ embeds: [unmuteEmbed] });
        } catch (err) {
            sendErrorEmbed("Impossibile rimuovere il muto. Controlla i permessi della gerarchia.");
        }
    }

    // --- COMANDO !clear [1-100] ---
    if (command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return sendErrorEmbed("Non hai i permessi per cancellare messaggi.");
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return sendErrorEmbed(`Uso corretto: \`${config.prefix}clear [1-100]\``);
        
        await message.channel.bulkDelete(amount, true);

        const clearEmbed = new EmbedBuilder()
            .setColor('#34495E')
            .setDescription(`🧹 Cancellati con successo **${amount}** messaggi.`);

        const msg = await message.channel.send({ embeds: [clearEmbed] });
        setTimeout(() => msg.delete().catch(() => {}), 4000);
    }
});

client.login(process.env.DISCORD_TOKEN);
