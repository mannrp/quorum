import {
  createSpikeProviderAccessor,
  isAuthProviderSpikeEnabled,
  type SpikeEnvironment,
} from "./boundary";
import { assessMutationOrigin, assessSessionCookie } from "./browser-security";
import { authorizeSpikeRoute, projectCredentialSafeJson } from "./route-policy";

export type SpikeRequest = Readonly<{
  method: string;
  path: string;
  origin?: string;
  secFetchSite?: string;
}>;

type SpikePurpose = Extract<
  ReturnType<typeof authorizeSpikeRoute>,
  { allowed: true }
>["purpose"];

export type SpikeProviderResponse = Readonly<{
  status: number;
  body: unknown;
  setCookies?: readonly string[];
}>;

export type SpikeProvider = Readonly<{
  dispatch(input: {
    purpose: SpikePurpose;
    request: SpikeRequest;
  }): Promise<SpikeProviderResponse>;
}>;

export type SpikeHandlerResponse = Readonly<{
  status: number;
  body: Record<string, unknown>;
  setCookies?: readonly string[];
}>;

type SpikeHandlerConfiguration = Readonly<{
  environment: SpikeEnvironment;
  expectedOrigin: string;
  loadProvider: () => Promise<SpikeProvider>;
}>;

function errorResponse(
  status: number,
  error: string,
): SpikeHandlerResponse {
  return { status, body: { error } };
}

export function createSpikeHandler(configuration: SpikeHandlerConfiguration) {
  const enabled = isAuthProviderSpikeEnabled(configuration.environment);
  const provider = createSpikeProviderAccessor(
    configuration.environment,
    configuration.loadProvider,
  );

  return async (request: SpikeRequest): Promise<SpikeHandlerResponse> => {
    if (!enabled) {
      return errorResponse(404, "not-found");
    }

    const authorization = authorizeSpikeRoute(request.method, request.path);
    if (!authorization.allowed) {
      return authorization.status === 404
        ? errorResponse(404, "not-found")
        : errorResponse(405, "method-not-allowed");
    }

    if (request.method !== "GET") {
      const origin = assessMutationOrigin(request, configuration.expectedOrigin);
      if (!origin.allowed) {
        return errorResponse(403, "forbidden");
      }
    }

    try {
      const response = await (
        await provider()
      ).dispatch({ purpose: authorization.purpose, request });

      if (
        !Number.isInteger(response.status) ||
        response.status < 200 ||
        response.status > 499 ||
        response.setCookies?.some(
          (cookie) => !assessSessionCookie(cookie).accepted,
        )
      ) {
        return errorResponse(502, "provider-rejected");
      }

      const projected: SpikeHandlerResponse = {
        status: response.status,
        body: projectCredentialSafeJson(response.body),
      };

      return response.setCookies
        ? { ...projected, setCookies: [...response.setCookies] }
        : projected;
    } catch {
      return errorResponse(502, "provider-rejected");
    }
  };
}
