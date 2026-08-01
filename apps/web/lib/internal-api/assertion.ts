import "server-only";
import { SignJWT } from "jose";

export const INTERNAL_ASSERTION_VERSION = "quorum-internal-v1";
export const INTERNAL_ASSERTION_JOSE_TYPE = "quorum-internal+jwt";
export const INTERNAL_ASSERTION_LIFETIME_SECONDS = 15;

type SignerConfig = { issuer:string; audience:string; keyId:string; privateKey:CryptoKey; now?:()=>Date };
type CommonInput = { correlationId:string; assertionId:string };
type AuthenticatedInput = CommonInput & { identityRealm:string; subject:string; authenticatedAt:Date; authenticationMethods:string[]; assurance:string; deviceHandle:string };

function required(value:string, name:string) { if (!value || value.trim() !== value) throw new Error(`${name} is required and must be trimmed`); return value; }

export function createInternalAssertionSigner(config: SignerConfig) {
  required(config.issuer,"issuer"); required(config.audience,"audience"); required(config.keyId,"keyId");
  const now = config.now ?? (()=>new Date());
  async function sign(payload:Record<string,unknown>, input:CommonInput) {
    const issuedAt = Math.floor(now().getTime()/1000);
    return new SignJWT({ typ:INTERNAL_ASSERTION_VERSION, ...payload, correlation_id:required(input.correlationId,"correlationId") })
      .setProtectedHeader({ alg:"EdDSA", kid:config.keyId, typ:INTERNAL_ASSERTION_JOSE_TYPE })
      .setIssuer(config.issuer).setAudience(config.audience).setIssuedAt(issuedAt).setNotBefore(issuedAt)
      .setExpirationTime(issuedAt+INTERNAL_ASSERTION_LIFETIME_SECONDS).setJti(required(input.assertionId,"assertionId"))
      .sign(config.privateKey);
  }
  return {
    authenticated(input:AuthenticatedInput) {
      if (!input.authenticationMethods.length) throw new Error("authenticationMethods is required");
      return sign({ actor_kind:"AUTHENTICATED", identity_realm:required(input.identityRealm,"identityRealm"), sub:required(input.subject,"subject"), authenticated_at:Math.floor(input.authenticatedAt.getTime()/1000), amr:input.authenticationMethods.map((item)=>required(item,"authenticationMethod")), assurance:required(input.assurance,"assurance"), device_handle:required(input.deviceHandle,"deviceHandle") }, input);
    },
    anonymous(input:CommonInput) { return sign({ actor_kind:"ANONYMOUS" }, input); },
  };
}