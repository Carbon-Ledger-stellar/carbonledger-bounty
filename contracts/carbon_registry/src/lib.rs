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
pub enum RegistryError {
    ProjectNotFound       = 1,
    ProjectNotVerified    = 2,
    ProjectSuspended      = 3,
    ProjectAlreadyExists  = 4,
    UnauthorizedVerifier  = 5,
    UnauthorizedAdmin     = 6,
    InvalidVintageYear    = 7,
    AlreadyInitialized    = 8,
    InvalidMetadataCid    = 9,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Project(String),
    ProjectList,
    Verifiers,
    OracleAddress,
    RegistryAdmin,
}

// ── Types ──────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProjectStatus {
    Pending,
    Verified,
    Rejected,
    Suspended,
    Completed,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CarbonProject {
    pub project_id:            String,
    pub name:                  String,
    pub methodology:           String,           // e.g., "Verra VCS"
    pub country:               String,
    pub project_type:          String,           // e.g., "Reforestation"
    pub verifier_address:      Address,
    pub metadata_cid:          String,           // IPFS hash
    pub total_credits_issued:  i128,
    pub total_credits_retired: i128,
    pub status:                ProjectStatus,
    pub vintage_year:          u32,
    pub created_at:            u64,
    pub owner_address:         Address,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonRegistryContract;

#[contractimpl]
impl CarbonRegistryContract {
    /// Initialize registry with admin and oracle address.
    /// Can only be called once.
    pub fn initialize(
        env: Env,
        admin: Address,
        oracle_address: Address,
    ) -> Result<(), RegistryError> {
        if env.storage().persistent().has(&DataKey::RegistryAdmin) {
            return Err(RegistryError::AlreadyInitialized);
        }

        env.storage().persistent().set(&DataKey::RegistryAdmin, &admin);
        env.storage().persistent().set(&DataKey::OracleAddress, &oracle_address);
        env.storage().persistent().set(&DataKey::ProjectList, &Vec::<String>::new(&env));

        Ok(())
    }

    /// Register a new carbon project.
    /// Returns project_id on success.
    pub fn register_project(
        env: Env,
        developer: Address,
        name: String,
        methodology: String,
        country: String,
        project_type: String,
        metadata_cid: String,
        vintage_year: u32,
        verifier_address: Address,
    ) -> Result<String, RegistryError> {
        developer.require_auth();

        // Validate inputs
        if metadata_cid.len() == 0 {
            return Err(RegistryError::InvalidMetadataCid);
        }

        let current_year = env.ledger().timestamp() / (365 * 24 * 60 * 60);
        if vintage_year > current_year as u32 + 1 {
            return Err(RegistryError::InvalidVintageYear);
        }

        // Generate project_id
        let project_id = String::from_slice(&env, &format!("proj-{}", env.ledger().sequence()).as_bytes());

        // Check if already exists
        let key = DataKey::Project(project_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(RegistryError::ProjectAlreadyExists);
        }

        // Create project
        let project = CarbonProject {
            project_id: project_id.clone(),
            name,
            methodology,
            country,
            project_type,
            verifier_address,
            metadata_cid,
            total_credits_issued: 0,
            total_credits_retired: 0,
            status: ProjectStatus::Pending,
            vintage_year,
            created_at: env.ledger().timestamp(),
            owner_address: developer,
        };

        // Store project
        env.storage().persistent().set(&key, &project);

        // Add to project list
        let mut projects = env
            .storage()
            .persistent()
            .get::<_, Vec<String>>(&DataKey::ProjectList)
            .unwrap_or(Vec::new(&env));
        projects.push_back(project_id.clone());
        env.storage().persistent().set(&DataKey::ProjectList, &projects);

        Ok(project_id)
    }

    /// Verify a project (requires verifier authorization).
    pub fn verify_project(env: Env, project_id: String) -> Result<(), RegistryError> {
        let key = DataKey::Project(project_id.clone());
        let mut project = env
            .storage()
            .persistent()
            .get::<_, CarbonProject>(&key)
            .ok_or(RegistryError::ProjectNotFound)?;

        // Require verifier authorization
        project.verifier_address.require_auth();

        project.status = ProjectStatus::Verified;
        env.storage().persistent().set(&key, &project);

        Ok(())
    }

    /// Reject a project (requires verifier authorization).
    pub fn reject_project(env: Env, project_id: String) -> Result<(), RegistryError> {
        let key = DataKey::Project(project_id.clone());
        let mut project = env
            .storage()
            .persistent()
            .get::<_, CarbonProject>(&key)
            .ok_or(RegistryError::ProjectNotFound)?;

        project.verifier_address.require_auth();

        project.status = ProjectStatus::Rejected;
        env.storage().persistent().set(&key, &project);

        Ok(())
    }

    /// Suspend a project (requires admin authorization).
    pub fn suspend_project(env: Env, project_id: String) -> Result<(), RegistryError> {
        let admin = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::RegistryAdmin)
            .ok_or(RegistryError::UnauthorizedAdmin)?;

        admin.require_auth();

        let key = DataKey::Project(project_id.clone());
        let mut project = env
            .storage()
            .persistent()
            .get::<_, CarbonProject>(&key)
            .ok_or(RegistryError::ProjectNotFound)?;

        project.status = ProjectStatus::Suspended;
        env.storage().persistent().set(&key, &project);

        Ok(())
    }

    /// Get project details (read-only).
    pub fn get_project(env: Env, project_id: String) -> Result<CarbonProject, RegistryError> {
        let key = DataKey::Project(project_id);
        env.storage()
            .persistent()
            .get::<_, CarbonProject>(&key)
            .ok_or(RegistryError::ProjectNotFound)
    }

    /// Update project status (admin only).
    pub fn update_status(
        env: Env,
        project_id: String,
        new_status: ProjectStatus,
    ) -> Result<(), RegistryError> {
        let admin = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::RegistryAdmin)
            .ok_or(RegistryError::UnauthorizedAdmin)?;

        admin.require_auth();

        let key = DataKey::Project(project_id);
        let mut project = env
            .storage()
            .persistent()
            .get::<_, CarbonProject>(&key)
            .ok_or(RegistryError::ProjectNotFound)?;

        project.status = new_status;
        env.storage().persistent().set(&key, &project);

        Ok(())
    }

    /// List all projects (read-only).
    pub fn list_projects(env: Env) -> Result<Vec<CarbonProject>, RegistryError> {
        let project_ids = env
            .storage()
            .persistent()
            .get::<_, Vec<String>>(&DataKey::ProjectList)
            .unwrap_or(Vec::new(&env));

        let mut projects = Vec::new(&env);
        for id in project_ids {
            if let Ok(project) = Self::get_project(env.clone(), id) {
                projects.push_back(project);
            }
        }

        Ok(projects)
    }
}
