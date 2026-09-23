declare module "sm-crypto" {
  export const sm2: {
    generateKeyPairHex: () => { publicKey: string; privateKey: string };
    doSignature: (
      msg: string,
      privateKey: string,
      options?: { hash?: boolean; der?: boolean; userId?: string },
    ) => string;
    doVerifySignature: (
      msg: string,
      signHex: string,
      publicKey: string,
      options?: { hash?: boolean; der?: boolean; userId?: string },
    ) => boolean;
  };
  export const sm3: (msg: string) => string;
}
