package org.samoxive.safetyjim.server.endpoints

import io.vertx.core.http.HttpMethod
import io.vertx.core.http.HttpServerRequest
import io.vertx.core.http.HttpServerResponse
import io.vertx.ext.web.RoutingContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import net.dv8tion.jda.api.entities.Guild
import net.dv8tion.jda.api.entities.Member
import net.dv8tion.jda.api.entities.User
import org.samoxive.safetyjim.database.KicksTable
import org.samoxive.safetyjim.database.SettingsEntity
import org.samoxive.safetyjim.discord.DiscordBot
import org.samoxive.safetyjim.server.*
import org.samoxive.safetyjim.server.models.KickModel
import org.samoxive.safetyjim.server.models.toKickModel

@Serializable
data class GetKicksEndpointResponse(
    val currentPage: Int,
    val totalPages: Int,
    val entries: List<KickModel>
)

class GetKicksEndpoint(bot: DiscordBot) : ModLogPaginationEndpoint(bot) {
    override suspend fun handle(event: RoutingContext, request: HttpServerRequest, response: HttpServerResponse, user: User, guild: Guild, member: Member, settings: SettingsEntity, page: Int): Result {
        val kicks = KicksTable.fetchGuildKicks(guild, page).map { it.toKickModel(bot) }
        val pageCount = (KicksTable.fetchGuildKicksCount(guild) / 10) + 1
        val body = GetKicksEndpointResponse(page, pageCount, kicks)
        response.endJson(Json.stringify(GetKicksEndpointResponse.serializer(), body))
        return Result(Status.OK)
    }

    override val route: String = "/guilds/:guildId/kicks"
    override val method: HttpMethod = HttpMethod.GET
}

class GetKickEndpoint(bot: DiscordBot) : ModLogEndpoint(bot) {
    override suspend fun handle(event: RoutingContext, request: HttpServerRequest, response: HttpServerResponse, user: User, guild: Guild, member: Member, settings: SettingsEntity): Result {
        val kickId = request.getParam("kickId") ?: return Result(Status.SERVER_ERROR, "How did this happen?")
        val id = kickId.toIntOrNull() ?: return Result(Status.BAD_REQUEST, "Invalid kick id!")
        val kick = KicksTable.fetchKick(id) ?: return Result(Status.NOT_FOUND, "Kick with given id doesn't exist!")

        response.endJson(Json.stringify(KickModel.serializer(), kick.toKickModel(bot)))
        return Result(Status.OK)
    }

    override val route: String = "/guilds/:guildId/kicks/:kickId"
    override val method: HttpMethod = HttpMethod.GET
}
