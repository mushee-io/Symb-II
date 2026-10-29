export type TydroReserve = {
  address: string;
  symbol: string;
  decimals: number;
  supplied: string;
  borrowed: string;
  supplyAprPct: number;
  borrowAprPct: number;
  ltvPct: number;
  liquidationThresholdPct: number;
  collateralEligible: boolean;
  borrowEnabled: boolean;
  active: boolean;
  frozen: boolean;
};
export type TydroMarketsResponse = {
  source: "Tydro (Aave V3 Ink) contracts";
  chainId: 57073;
  updatedAt: string;
  pool: string;
  reserves: TydroReserve[];
  warnings: string[];
  incomplete: boolean;
};
export type TydroUserReserve = {
  address: string;
  symbol: string;
  supplied: string;
  variableDebt: string;
  stableDebt: string;
  usingAsCollateral: boolean;
};
export type TydroAccountResponse = {
  source: "Tydro (Aave V3 Ink) contracts";
  chainId: 57073;
  updatedAt: string;
  address: string;
  pool: string;
  collateralBase: string;
  debtBase: string;
  availableBorrowsBase: string;
  baseCurrency: "Oracle base units";
  healthFactor: string | null;
  liquidationThresholdPct: number;
  ltvPct: number;
  userReserves: TydroUserReserve[];
  warnings: string[];
  incomplete: boolean;
};
