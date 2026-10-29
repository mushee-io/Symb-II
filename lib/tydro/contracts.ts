/**
 * Tydro / Aave V3 Ink Whitelabel deployed contracts.
 * Source: https://github.com/aave-dao/aave-address-book/blob/main/src/ts/AaveV3InkWhitelabel.ts
 * Never accept pool/asset addresses from user supplied query parameters.
 */
import { parseAbi } from "viem";

export const TYDRO = {
  chainId: 57073,
  pool: "0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA",
  poolAddressesProvider: "0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D",
  poolDataProvider: "0x96086C25d13943C80Ff9a19791a40Df6aFC08328",
  oracle: "0x4758213271BFdC72224A7a8742dC865fC97756e1",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
} as const;

export const providerAbi = parseAbi([
  "function getPool() view returns (address)",
]);
export const poolAbi = parseAbi([
  "function getReservesList() view returns (address[])",
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);
export const poolDataProviderAbi = parseAbi([
  "function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)",
  "function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
  "function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)",
]);
export const erc20SymbolAbi = parseAbi(["function symbol() view returns (string)"]);
export const oracleAbi = parseAbi(["function BASE_CURRENCY_UNIT() view returns (uint256)"]);
