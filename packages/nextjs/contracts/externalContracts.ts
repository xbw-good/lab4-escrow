import deployedContracts from "./deployedContracts";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  60600: {
    Escrow_AsC: {
      address: "0xE35d45037913Fd6868a820E99d2ad45ce969b5b8",
      abi: deployedContracts[60600].Escrow.abi,
    },
    Token_AsC: {
      address: "0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467",
      abi: deployedContracts[60600].XBWToken.abi,
    },
    Escrow_AsB: {
      address: "0xa8822b7CB2D3c7548c18F9f6CD7B2036ed9FC385",
      abi: deployedContracts[60600].Escrow.abi,
    },
    Token_AsB: {
      address: "0x5a801Ae287ee213133Ba89A36C4A9FB2e80080FC",
      abi: deployedContracts[60600].XBWToken.abi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;