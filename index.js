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
    
    // Cambia automaticamente Nome e Foto all'avvio usando il config.json
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

    // Funzione rapida per mandare gli errori in rosso
    const sendErrorEmbed = (text) => {
        const errEmbed = new EmbedBuilder().setColor('#FF3333').setDescription(`❌ ${text}`);
        return message.reply({ embeds: [errEmbed] });
    };

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
        const duration = parseInt(args[0]);
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
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return sendErrorEmbed("Inserisci un numero da 1 a 100 messaggi da eliminare.");
        
        await message.channel.bulkDelete(amount, true);

        const clearEmbed = new EmbedBuilder()
            .setColor('#34495E')
            .setDescription(`🧹 Cancellati con successo **${amount}** messaggi.`);

        const msg = await message.channel.send({ embeds: [clearEmbed] });
        setTimeout(() => msg.delete().catch(() => {}), 4000);
    }
});

// Legge il Token inserito nelle impostazioni segrete di Render
client.login(process.env.DISCORD_TOKEN);
