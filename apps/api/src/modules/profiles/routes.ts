import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { InvalidImageError } from "../../photos/pipeline.js";
import { createUploadUrl } from "../../storage/s3.js";
import {
  acceptTermsBodySchema,
  avatarCompleteBodySchema,
  avatarUploadUrlBodySchema,
  avatarUploadUrlResponseSchema,
  errorResponseSchema,
  meResponseSchema,
  patchMeBodySchema,
  publicProfileResponseSchema,
  usernameParamSchema,
} from "./schemas.js";
import {
  acceptTerms,
  avatarQuarantineKey,
  completeAvatarUpload,
  getOwnProfile,
  getPublicProfile,
  InvalidAvatarKeyError,
  updateOwnProfile,
  UsernameTakenError,
} from "./service.js";
import type { ProfileRow } from "./repo.js";

function toMeResponse(
  user: { id: string; email: string; emailVerified: boolean },
  profile: ProfileRow,
) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarKey: profile.avatarKey,
    isPrivate: profile.isPrivate,
    locale: profile.locale,
    role: profile.role,
    plan: profile.plan,
    status: profile.status,
    ageConfirmedAt: profile.ageConfirmedAt?.toISOString() ?? null,
    termsAcceptedAt: profile.termsAcceptedAt?.toISOString() ?? null,
    termsVersion: profile.termsVersion,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export default async function profileRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.route({
    method: "GET",
    url: "/v1/me",
    preHandler: app.requireSession,
    schema: { response: { 200: meResponseSchema } },
    handler: async (request) => {
      const { user } = request.session!;
      const profile = await getOwnProfile(app.db, user.id);
      if (!profile) throw app.httpErrors.notFound();
      return toMeResponse(user, profile);
    },
  });

  typed.route({
    method: "PATCH",
    url: "/v1/me",
    preHandler: app.requireSession,
    schema: {
      body: patchMeBodySchema,
      response: { 200: meResponseSchema, 409: errorResponseSchema },
    },
    handler: async (request, reply) => {
      const { user } = request.session!;
      try {
        const profile = await updateOwnProfile(app.db, user.id, request.body);
        return toMeResponse(user, profile);
      } catch (error) {
        if (error instanceof UsernameTakenError) {
          return reply.status(409).send({
            error: { code: "username_taken", message: "That username is already taken." },
          });
        }
        throw error;
      }
    },
  });

  typed.route({
    method: "GET",
    url: "/v1/users/:username",
    preHandler: app.requireSession,
    schema: { params: usernameParamSchema, response: { 200: publicProfileResponseSchema } },
    handler: async (request) => {
      const { user } = request.session!;
      const view = await getPublicProfile(app.db, user.id, request.params.username);
      if (!view) throw app.httpErrors.notFound();

      if (view.kind === "private") {
        return {
          username: view.profile.username,
          displayName: view.profile.displayName,
          avatarKey: view.profile.avatarKey,
          isPrivate: true,
        };
      }
      return {
        username: view.profile.username,
        displayName: view.profile.displayName,
        avatarKey: view.profile.avatarKey,
        isPrivate: view.profile.isPrivate,
        bio: view.profile.bio,
      };
    },
  });

  typed.route({
    method: "POST",
    url: "/v1/me/accept-terms",
    preHandler: app.requireSession,
    schema: { body: acceptTermsBodySchema, response: { 200: meResponseSchema } },
    handler: async (request) => {
      const { user } = request.session!;
      const profile = await acceptTerms(app.db, user.id, request.body.termsVersion);
      return toMeResponse(user, profile);
    },
  });

  typed.route({
    method: "POST",
    url: "/v1/me/avatar/upload-url",
    preHandler: app.requireSession,
    schema: { body: avatarUploadUrlBodySchema, response: { 200: avatarUploadUrlResponseSchema } },
    handler: async (request) => {
      const { user } = request.session!;
      const { contentType, contentLength } = request.body;
      const key = avatarQuarantineKey(user.id);
      const url = await createUploadUrl(
        app.s3,
        app.buckets.quarantine,
        key,
        contentType,
        contentLength,
      );
      return {
        url,
        key,
        headers: { "Content-Type": contentType, "Content-Length": String(contentLength) },
      };
    },
  });

  typed.route({
    method: "POST",
    url: "/v1/me/avatar/complete",
    preHandler: app.requireSession,
    schema: {
      body: avatarCompleteBodySchema,
      response: { 200: meResponseSchema, 400: errorResponseSchema },
    },
    handler: async (request, reply) => {
      const { user } = request.session!;
      try {
        const profile = await completeAvatarUpload(
          { db: app.db, s3: app.s3, buckets: app.buckets },
          user.id,
          request.body.key,
        );
        return toMeResponse(user, profile);
      } catch (error) {
        if (error instanceof InvalidImageError || error instanceof InvalidAvatarKeyError) {
          return reply.status(400).send({
            error: { code: "invalid_image", message: "Could not process that image." },
          });
        }
        throw error;
      }
    },
  });
}
