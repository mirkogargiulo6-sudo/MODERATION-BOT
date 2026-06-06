const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('./config.json');

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
                  `\`${config.prefix}mute @utente [minuti]\` - Isola temporalmente un utente.\n` +
                  `\`${config.prefix}unmute @utente\` - Rimuove l'isolamento a un utente.\n` +
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

    // --- COMANDO !kick @utente [motivo] ---
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return sendErrorEmbed("Non hai i permessi per cacciare utenti.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed("Menziona un utente valido da espellere.");
        const reason = args.join(" ") || "Nessun motivo specificato";
        
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
    }

    // --- COMANDO !ban @utente [motivo] ---
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendErrorEmbed("Non hai i permessi per bannare utenti.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed("Menziona un utente valido da bannare.");
        const reason = args.join(" ") || "Nessun motivo specificato";
        
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
    }

    // --- COMANDO !mute @utente [minuti] ---
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendErrorEmbed("Non hai i permessi per isolare utenti.");
        const target = message.mentions.members.first();
        const duration = parseInt(args);
        if (!target || isNaN(duration)) return sendErrorEmbed("Uso corretto: `!mute @utente [minuti]`");
        
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
    }

    // --- COMANDO !unmute @utente ---
    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendErrorEmbed("Non hai i permessi per togliere il muto.");
        const target = message.mentions.members.first();
        if (!target) return sendErrorEmbed("Menziona un utente a cui togliere il muto.");
        
        await target.timeout(null);

        const unmuteEmbed = new EmbedBuilder()
            .setColor('#3498DB')
            .setDescription(`🔊 Il muto a **${target.user.tag}** è stato rimosso con successo.`);

        message.channel.send({ embeds: [unmuteEmbed] });
    }

    // --- COMANDO !clear [1-100] ---
    if (command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return sendErrorEmbed("Non hai i permessi per cancellare messaggi.");
        const amount = parseInt(args);
        if (isNaN(amount) || amount < 1 || amount > 100) return sendErrorEmbed("Inserisci un numero da 1 a 100 messaggi da eliminare.");
        
        await message.channel.bulkDelete(amount, true);

        const clearEmbed = new EmbedBuilder()
            .setColor('#34495E')
            .setDescription(`🧹 Cancellati con successo **${amount}** messaggi.`);

        const msg = await message.channel.send({ embeds: [clearEmbed] });
        setTimeout(() => msg.delete().catch(() => {}), 4000);
    }
});

client.login(process.env.DISCORD_TOKEN);


