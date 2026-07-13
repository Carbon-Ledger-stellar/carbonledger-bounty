#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec, Map,
    symbol_short, vec,
};

// ── Error Enum ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CreditError {
    ProjectNotFound        = 1,
    ProjectNotVerified     = 2,
    ProjectSuspended       = 3,
    InsufficientCredits    = 4,
    AlreadyRetired         = 5,
    SerialNumberConflict   = 6,
    UnauthorizedDeveloper  = 7,
    InvalidSerialRange     = 8,
    BatchNotFound          = 9,
    RetirementIrreversible = 10,
    ZeroAmountNotAllowed   = 11,
    UnauthorizedAdmin      = 12,
    AlreadyInitialized     = 13,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Batch(String),
    Retirement(String),
    ProjectBatches(String),
    SerialRegistry,
    Admin,
    RegistryContract,
}

// ── Types ──────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CreditStatus {
    Active,
    PartiallyRetired,
    FullyRetired,
    Suspended,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CreditBatch {
    pub batch_id:     String,
    pub project_id:   String,
    pub vintage_year: u32,
    pub amount:       i128,
    pub serial_start: u64,
    pub serial_end:   u64,
    pub issued_at:    u64,
    pub status:       CreditStatus,
    pub metadata_cid: String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct RetirementCertificate {
    pub retirement_id:    String,
    pub credit_batch_id:  String,
    pub project_id:       String,
    pub amount:           i128,
    pub retired_by:       Address,
    pub benefactor:       String,
    pub retired_at:       u64,
    pub tx_hash:          String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct SerialRange {
    pub serial_start: u64,
    pub serial_end:   u64,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonCreditContract;

#[contractimpl]
impl CarbonCreditContract {
    /// Initialize contract with admin and registry contract.
    pub fn initialize(env: Env, admin: Address, registry_contract: Address) -> Result<(), CreditError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(CreditError::AlreadyInitialized);
        }

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::RegistryContract, &registry_contract);

        Ok(())
    }

    /// Mint a new batch of carbon credits.
    /// Returns batch_id on success.
    pub fn mint_credits(
        env: Env,
        project_id: String,
        amount: i128,
        serial_start: u64,
        metadata_cid: String,
    ) -> Result<String, CreditError> {
        if amount <= 0 {
            return Err(CreditError::ZeroAmountNotAllowed);
        }

        // Check serial range
        let serial_end = serial_start + (amount as u64) - 1;
        Self::verify_serial_range(env.clone(), serial_start, serial_end)?;

        // Generate batch_id
        let batch_id = String::from_slice(
            &env,
            &format!("batch-{}-{}", env.ledger().sequence(), serial_start).as_bytes(),
        );

        // Create batch
        let batch = CreditBatch {
            batch_id: batch_id.clone(),
            project_id,
            vintage_year: env.ledger().timestamp() as u32 / (365 * 24 * 60 * 60) as u32,
            amount,
            serial_start,
            serial_end,
            issued_at: env.ledger().timestamp(),
            status: CreditStatus::Active,
            metadata_cid,
        };

        // Store batch
        env.storage()
            .persistent()
            .set(&DataKey::Batch(batch_id.clone()), &batch);

        // Register serial range
        Self::register_serial_range(env, serial_start, serial_end)?;

        Ok(batch_id)
    }

    /// Verify that a serial range doesn't overlap existing batches.
    pub fn verify_serial_range(env: Env, serial_start: u64, serial_end: u64) -> Result<bool, CreditError> {
        let registry = env
            .storage()
            .persistent()
            .get::<_, Vec<SerialRange>>(&DataKey::SerialRegistry)
            .unwrap_or(Vec::new(&env));

        for range in registry {
            if (serial_start >= range.serial_start && serial_start <= range.serial_end)
                || (serial_end >= range.serial_start && serial_end <= range.serial_end)
                || (serial_start < range.serial_start && serial_end > range.serial_end)
            {
                return Err(CreditError::SerialNumberConflict);
            }
        }

        Ok(true)
    }

    /// Register a serial range (internal use).
    fn register_serial_range(env: Env, serial_start: u64, serial_end: u64) -> Result<(), CreditError> {
        let mut registry = env
            .storage()
            .persistent()
            .get::<_, Vec<SerialRange>>(&DataKey::SerialRegistry)
            .unwrap_or(Vec::new(&env));

        registry.push_back(SerialRange {
            serial_start,
            serial_end,
        });

        env.storage()
            .persistent()
            .set(&DataKey::SerialRegistry, &registry);

        Ok(())
    }

    /// Retire credits (IRREVERSIBLE).
    /// Returns retirement_id on success.
    pub fn retire_credits(
        env: Env,
        retiree: Address,
        benefactor: String,
        project_id: String,
        batch_id: String,
        amount: i128,
        tx_hash: String,
    ) -> Result<String, CreditError> {
        retiree.require_auth();

        if amount <= 0 {
            return Err(CreditError::ZeroAmountNotAllowed);
        }

        // Get batch
        let mut batch = env
            .storage()
            .persistent()
            .get::<_, CreditBatch>(&DataKey::Batch(batch_id.clone()))
            .ok_or(CreditError::BatchNotFound)?;

        // Verify batch is not fully retired
        if batch.status == CreditStatus::FullyRetired {
            return Err(CreditError::RetirementIrreversible);
        }

        // Verify sufficient credits available
        if amount > batch.amount {
            return Err(CreditError::InsufficientCredits);
        }

        // Generate retirement_id
        let retirement_id = String::from_slice(
            &env,
            &format!("ret-{}-{}", env.ledger().sequence(), env.ledger().timestamp()).as_bytes(),
        );

        // Create retirement certificate
        let certificate = RetirementCertificate {
            retirement_id: retirement_id.clone(),
            credit_batch_id: batch_id.clone(),
            project_id,
            amount,
            retired_by: retiree,
            benefactor,
            retired_at: env.ledger().timestamp(),
            tx_hash,
        };

        // Store retirement certificate (IMMUTABLE)
        env.storage()
            .persistent()
            .set(&DataKey::Retirement(retirement_id.clone()), &certificate);

        // Update batch
        batch.amount -= amount;
        batch.status = if batch.amount == 0 {
            CreditStatus::FullyRetired
        } else {
            CreditStatus::PartiallyRetired
        };

        env.storage()
            .persistent()
            .set(&DataKey::Batch(batch_id.clone()), &batch);

        Ok(retirement_id)
    }

    /// Get credit batch details (read-only).
    pub fn get_credit_batch(env: Env, batch_id: String) -> Result<CreditBatch, CreditError> {
        env.storage()
            .persistent()
            .get::<_, CreditBatch>(&DataKey::Batch(batch_id))
            .ok_or(CreditError::BatchNotFound)
    }

    /// Get retirement certificate (read-only).
    pub fn get_retirement_certificate(
        env: Env,
        retirement_id: String,
    ) -> Result<RetirementCertificate, CreditError> {
        env.storage()
            .persistent()
            .get::<_, RetirementCertificate>(&DataKey::Retirement(retirement_id))
            .ok_or(CreditError::BatchNotFound)
    }

    /// Get retirement history for a benefactor (read-only).
    pub fn get_retirement_history(
        env: Env,
        benefactor: String,
    ) -> Result<Vec<RetirementCertificate>, CreditError> {
        // This is a simplified version; in production, maintain an index
        // For now, return empty vec (backend queries DB instead)
        Ok(Vec::new(&env))
    }
}
