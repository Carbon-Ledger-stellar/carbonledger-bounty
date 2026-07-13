#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
    symbol_short, vec,
};

// ── Constants ──────────────────────────────────────────────────────────────────

/// 365 days in seconds — monitoring data older than this is considered stale.
const MONITORING_FRESHNESS_SECS: u64 = 365 * 24 * 60 * 60;
/// 24 hours in ledger TTL units (each ledger ~5 s → 17_280 ledgers/day).
const PRICE_CACHE_TTL_LEDGERS: u32 = 17_280;

// ── Error Enum ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OracleError {
    ProjectNotFound         = 1,
    MonitoringDataStale     = 2,
    PriceNotSet             = 3,
    UnauthorizedOracle      = 4,
    UnauthorizedAdmin       = 5,
    InvalidVintageYear      = 6,
    InvalidScore            = 7,
    AlreadyInitialized      = 8,
    InvalidAmount           = 9,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    MonitoringData(String, String),   // (project_id, period)
    LatestMonitoring(String),         // project_id → latest timestamp
    BenchmarkPrice(String, u32),      // (methodology, vintage_year)
    FlaggedProject(String),
    OracleAddress,
    Admin,
}

// ── Types ──────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct MonitoringData {
    pub project_id:        String,
    pub period:            String,
    pub tonnes_verified:   i128,
    pub methodology_score: u32,
    pub satellite_cid:     String,
    pub submitted_by:      Address,
    pub submitted_at:      u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BenchmarkPrice {
    pub methodology:      String,
    pub vintage_year:     u32,
    pub price_per_credit: i128,
    pub updated_at:       u64,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonOracleContract;

#[contractimpl]
impl CarbonOracleContract {
    /// Initialize oracle with admin and authorized oracle address.
    pub fn initialize(env: Env, admin: Address, oracle_address: Address) -> Result<(), OracleError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(OracleError::AlreadyInitialized);
        }

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::OracleAddress, &oracle_address);

        Ok(())
    }

    /// Submit monitoring data for a project.
    /// Returns monitoring record ID on success.
    pub fn submit_monitoring_data(
        env: Env,
        project_id: String,
        period: String,
        tonnes_verified: i128,
        methodology_score: u32,
        satellite_cid: String,
    ) -> Result<String, OracleError> {
        let oracle_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::OracleAddress)
            .ok_or(OracleError::UnauthorizedOracle)?;

        oracle_address.require_auth();

        if tonnes_verified <= 0 {
            return Err(OracleError::InvalidAmount);
        }

        if methodology_score > 100 {
            return Err(OracleError::InvalidScore);
        }

        let monitoring = MonitoringData {
            project_id: project_id.clone(),
            period: period.clone(),
            tonnes_verified,
            methodology_score,
            satellite_cid,
            submitted_by: oracle_address,
            submitted_at: env.ledger().timestamp(),
        };

        // Store monitoring data
        let key = DataKey::MonitoringData(project_id.clone(), period);
        env.storage().persistent().set(&key, &monitoring);

        // Update latest monitoring timestamp
        env.storage().persistent().set(
            &DataKey::LatestMonitoring(project_id.clone()),
            &env.ledger().timestamp(),
        );

        let record_id = String::from_slice(
            &env,
            &format!("mon-{}-{}", env.ledger().sequence(), tonnes_verified).as_bytes(),
        );

        Ok(record_id)
    }

    /// Update benchmark price for a methodology + vintage.
    pub fn update_benchmark_price(
        env: Env,
        methodology: String,
        vintage_year: u32,
        price_per_credit: i128,
    ) -> Result<(), OracleError> {
        let oracle_address = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::OracleAddress)
            .ok_or(OracleError::UnauthorizedOracle)?;

        oracle_address.require_auth();

        if price_per_credit <= 0 {
            return Err(OracleError::InvalidAmount);
        }

        let price = BenchmarkPrice {
            methodology: methodology.clone(),
            vintage_year,
            price_per_credit,
            updated_at: env.ledger().timestamp(),
        };

        let key = DataKey::BenchmarkPrice(methodology, vintage_year);
        env.storage().persistent().set(&key, &price);

        Ok(())
    }

    /// Check if monitoring data for a project is current (≤ 365 days old).
    pub fn is_monitoring_current(env: Env, project_id: String) -> Result<bool, OracleError> {
        let latest_timestamp = env
            .storage()
            .persistent()
            .get::<_, u64>(&DataKey::LatestMonitoring(project_id))
            .ok_or(OracleError::ProjectNotFound)?;

        let current_time = env.ledger().timestamp();
        Ok(current_time - latest_timestamp <= MONITORING_FRESHNESS_SECS)
    }

    /// Get benchmark price for methodology + vintage (read-only).
    pub fn get_benchmark_price(
        env: Env,
        methodology: String,
        vintage_year: u32,
    ) -> Result<i128, OracleError> {
        let key = DataKey::BenchmarkPrice(methodology, vintage_year);
        let price = env
            .storage()
            .persistent()
            .get::<_, BenchmarkPrice>(&key)
            .ok_or(OracleError::PriceNotSet)?;

        Ok(price.price_per_credit)
    }

    /// Flag a project for investigation (admin only).
    pub fn flag_project(env: Env, project_id: String) -> Result<(), OracleError> {
        let admin = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::Admin)
            .ok_or(OracleError::UnauthorizedAdmin)?;

        admin.require_auth();

        let key = DataKey::FlaggedProject(project_id);
        env.storage().persistent().set(&key, &true);

        Ok(())
    }

    /// Check if a project is flagged (read-only).
    pub fn is_project_flagged(env: Env, project_id: String) -> Result<bool, OracleError> {
        let key = DataKey::FlaggedProject(project_id);
        Ok(env.storage().persistent().get::<_, bool>(&key).unwrap_or(false))
    }

    /// Get monitoring data for a project + period (read-only).
    pub fn get_monitoring_data(
        env: Env,
        project_id: String,
        period: String,
    ) -> Result<MonitoringData, OracleError> {
        let key = DataKey::MonitoringData(project_id, period);
        env.storage()
            .persistent()
            .get::<_, MonitoringData>(&key)
            .ok_or(OracleError::ProjectNotFound)
    }
}
