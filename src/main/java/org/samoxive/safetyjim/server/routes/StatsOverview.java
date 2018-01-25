package org.samoxive.safetyjim.server.routes;

import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.http.HttpServerResponse;
import io.vertx.ext.web.RoutingContext;
import net.dv8tion.jda.core.Permission;
import net.dv8tion.jda.core.entities.Guild;
import net.dv8tion.jda.core.entities.Member;
import org.jooq.DSLContext;
import org.json.JSONObject;
import org.samoxive.jooq.generated.Tables;
import org.samoxive.jooq.generated.tables.records.SettingsRecord;
import org.samoxive.safetyjim.config.Config;
import org.samoxive.safetyjim.database.DatabaseUtils;
import org.samoxive.safetyjim.discord.DiscordBot;
import org.samoxive.safetyjim.discord.DiscordUtils;
import org.samoxive.safetyjim.server.RequestHandler;
import org.samoxive.safetyjim.server.Server;
import org.samoxive.safetyjim.server.ServerUtils;

import java.util.Map;
import java.util.stream.Collectors;

public class StatsOverview extends RequestHandler {
    public StatsOverview(DiscordBot bot, DSLContext database, Server server, Config config) {
        super(bot, database, server, config);
    }

    @Override
    public void handle(RoutingContext ctx, Server server, DiscordBot bot, DSLContext database) {
        HttpServerRequest request = ctx.request();
        HttpServerResponse response = ctx.response();

        String userId = ServerUtils.authUser(request, response, config);
        if (userId == null) {
            return;
        }

        String guildId = request.getParam("guildId");
        String fromParam = request.getParam("from");
        String toParam = request.getParam("to");

        long from;
        long to;

        try {
            from = Long.parseLong(fromParam);
            to = Long.parseLong(toParam);

            if (from <= 0 || to <= 0 || from >= to) {
                response.setStatusCode(400);
                response.end();
                return;
            }
        } catch (NumberFormatException e) {
            response.setStatusCode(400);
            response.end();
            return;
        }

        Guild guild = DiscordUtils.getGuildFromBot(bot, guildId);
        if (guild == null) {
            response.setStatusCode(404);
            response.end();
            return;
        }

        Member member = guild.getMemberById(userId);
        if (member == null) {
            response.setStatusCode(403);
            response.end();
            return;
        }

        SettingsRecord settings = DatabaseUtils.getGuildSettings(database, guild);
        if (!settings.getStatistics()) {
            response.setStatusCode(418);
            response.end();
            return;
        }

        Map<String, Integer> channelStats = guild.getTextChannels()
                                          .stream()
                                          .filter((channel) -> member.hasPermission(channel, Permission.MESSAGE_READ))
                                          .collect(Collectors.toMap((channel) -> channel.getName(), (channel) ->
                                              database.fetchCount(
                                                      database.selectFrom(Tables.MESSAGES)
                                                              .where(Tables.MESSAGES.GUILDID.eq(guildId))
                                                              .and(Tables.MESSAGES.CHANNELID.eq(channel.getId()))
                                                              .and(Tables.MESSAGES.DATE.between(from, to))
                                              )
                                          ));

        JSONObject result = new JSONObject();
        result.put("delta", to - from);
        result.put("channelStats", channelStats);
        response.putHeader("Content-Type", "application/json");
        response.end(result.toString());
    }
}
