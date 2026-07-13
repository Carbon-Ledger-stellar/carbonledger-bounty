#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
    symbol_short, vec,
    token,
};

// ── Error Enum ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarketplaceError {
    ListingNotFound         = 1,
    ListingNotActive        = 2,
    InsufficientLiquidity   = 3,
    InsufficientCredits     = 4,
    InsufficientUSDC        = 5,
    UnauthorizedSeller      = 6,
    UnauthorizedBuyer       = 7,
    InvalidAmount           = 8,
    PriceNotSet             = 9,
    AlreadyInitialized      = 10,
    InvalidPrice            = 11,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Listing(String),
    AllListings,
    Admin,
    CreditContract,
    UsdcToken,
}

// ── Types ──────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ListingStatus {
    Active,
    PartiallyFilled,
    Sold,
    Delisted,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct MarketListing {
    pub listing_id:       String,
    pub seller:           Address,
    pub batch_id:         String,
    pub project_id:       String,
    pub amount_available: i128,
    pub price_per_credit: i128,
    pub vintage_year:     u32,
    pub methodology:      String,
    pub country:          String,
    pub created_at:       u64,
    pub status:           ListingStatus,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonMarketplaceContract;

#[contractimpl]
impl CarbonMarketplaceContract {
    /// Initialize marketplace with admin, credit contract, and USDC token.
    pub fn initialize(
        env: Env,
        admin: Address,
        credit_contract: Address,
        usdc_token: Address,
    ) -> Result<(), MarketplaceError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(MarketplaceError::AlreadyInitialized);
        }

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::CreditContract, &credit_contract);
        env.storage().persistent().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().persistent().set(&DataKey::AllListings, &Vec::<String>::new(&env));

        Ok(())
    }

    /// List credits on the marketplace.
    /// Returns listing_id on success.
    pub fn list_credits(
        env: Env,
        seller: Address,
        batch_id: String,
        project_id: String,
        amount_available: i128,
        price_per_credit: i128,
        vintage_year: u32,
        methodology: String,
        country: String,
    ) -> Result<String, MarketplaceError> {
        seller.require_auth();

        if amount_available <= 0 {
            return Err(MarketplaceError::InvalidAmount);
        }
        if price_per_credit <= 0 {
            return Err(MarketplaceError::InvalidPrice);
        }

        // Generate listing_id
        let listing_id = String::from_slice(
            &env,
            &format!("list-{}-{}", env.ledger().sequence(), batch_id.len()).as_bytes(),
        );

        // Create listing
        let listing = MarketListing {
            listing_id: listing_id.clone(),
            seller,
            batch_id,
            project_id,
            amount_available,
            price_per_credit,
            vintage_year,
            methodology,
            country,
            created_at: env.ledger().timestamp(),
            status: ListingStatus::Active,
        };

        // Store listing
        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id.clone()), &listing);

        // Add to listings index
        let mut listings = env
            .storage()
            .persistent()
            .get::<_, Vec<String>>(&DataKey::AllListings)
            .unwrap_or(Vec::new(&env));
        listings.push_back(listing_id.clone());
        env.storage().persistent().set(&DataKey::AllListings, &listings);

        Ok(listing_id)
    }

    /// Delist credits from marketplace.
    pub fn delist_credits(env: Env, listing_id: String) -> Result<(), MarketplaceError> {
        let key = DataKey::Listing(listing_id.clone());
        let mut listing = env
            .storage()
            .persistent()
            .get::<_, MarketListing>(&key)
            .ok_or(MarketplaceError::ListingNotFound)?;

        listing.seller.require_auth();

        listing.status = ListingStatus::Delisted;
        env.storage().persistent().set(&key, &listing);

        Ok(())
    }

    /// Purchase credits from marketplace.
    /// Returns transaction ID on success.
    pub fn purchase_credits(
        env: Env,
        buyer: Address,
        listing_id: String,
        amount: i128,
    ) -> Result<String, MarketplaceError> {
        buyer.require_auth();

        if amount <= 0 {
            return Err(MarketplaceError::InvalidAmount);
        }

        let key = DataKey::Listing(listing_id.clone());
        let mut listing = env
            .storage()
            .persistent()
            .get::<_, MarketListing>(&key)
            .ok_or(MarketplaceError::ListingNotFound)?;

        // Check listing is active
        if listing.status == ListingStatus::Sold || listing.status == ListingStatus::Delisted {
            return Err(MarketplaceError::ListingNotActive);
        }

        // Check sufficient amount available
        if amount > listing.amount_available {
            return Err(MarketplaceError::InsufficientCredits);
        }

        // Calculate total cost in stroops
        let total_cost = amount.checked_mul(listing.price_per_credit)
            .ok_or(MarketplaceError::InvalidAmount)?;

        // Transfer USDC from buyer to seller
        let usdc_token = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::UsdcToken)
            .ok_or(MarketplaceError::PriceNotSet)?;

        let usdc_client = token::Client::new(&env, &usdc_token);

        usdc_client.transfer(
            &buyer,
            &listing.seller,
            &total_cost,
        );

        // Update listing status
        listing.amount_available -= amount;
        listing.status = if listing.amount_available == 0 {
            ListingStatus::Sold
        } else {
            ListingStatus::PartiallyFilled
        };

        env.storage().persistent().set(&key, &listing);

        // Generate transaction ID
        let tx_id = String::from_slice(
            &env,
            &format!("tx-{}-{}", env.ledger().sequence(), amount).as_bytes(),
        );

        Ok(tx_id)
    }

    /// Bulk purchase from multiple listings.
    pub fn bulk_purchase(
        env: Env,
        buyer: Address,
        purchases: Vec<(String, i128)>,
    ) -> Result<String, MarketplaceError> {
        buyer.require_auth();

        let mut total_cost: i128 = 0;

        // Calculate total cost
        for (listing_id, amount) in purchases.iter() {
            let listing = env
                .storage()
                .persistent()
                .get::<_, MarketListing>(&DataKey::Listing(listing_id.clone()))
                .ok_or(MarketplaceError::ListingNotFound)?;

            if amount <= 0 {
                return Err(MarketplaceError::InvalidAmount);
            }

            let cost = amount.checked_mul(listing.price_per_credit)
                .ok_or(MarketplaceError::InvalidAmount)?;

            total_cost = total_cost.checked_add(cost)
                .ok_or(MarketplaceError::InvalidAmount)?;
        }

        // Transfer all USDC at once
        let usdc_token = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::UsdcToken)
            .ok_or(MarketplaceError::PriceNotSet)?;

        let usdc_client = token::Client::new(&env, &usdc_token);

        // Process each purchase
        for (listing_id, amount) in purchases.iter() {
            let key = DataKey::Listing(listing_id.clone());
            let mut listing = env
                .storage()
                .persistent()
                .get::<_, MarketListing>(&key)
                .ok_or(MarketplaceError::ListingNotFound)?;

            if listing.status == ListingStatus::Sold || listing.status == ListingStatus::Delisted {
                return Err(MarketplaceError::ListingNotActive);
            }

            if amount > &listing.amount_available {
                return Err(MarketplaceError::InsufficientCredits);
            }

            let item_cost = amount.checked_mul(listing.price_per_credit)
                .ok_or(MarketplaceError::InvalidAmount)?;

            usdc_client.transfer(
                &buyer,
                &listing.seller,
                &item_cost,
            );

            listing.amount_available -= amount;
            listing.status = if listing.amount_available == 0 {
                ListingStatus::Sold
            } else {
                ListingStatus::PartiallyFilled
            };

            env.storage().persistent().set(&key, &listing);
        }

        let bulk_tx_id = String::from_slice(
            &env,
            &format!("bulk-{}-{}", env.ledger().sequence(), total_cost).as_bytes(),
        );

        Ok(bulk_tx_id)
    }

    /// Get active listings (read-only).
    pub fn get_active_listings(env: Env) -> Result<Vec<MarketListing>, MarketplaceError> {
        let listing_ids = env
            .storage()
            .persistent()
            .get::<_, Vec<String>>(&DataKey::AllListings)
            .unwrap_or(Vec::new(&env));

        let mut listings = Vec::new(&env);
        for id in listing_ids {
            if let Ok(listing) = env.storage().persistent().get::<_, MarketListing>(&DataKey::Listing(id)) {
                if listing.status == ListingStatus::Active || listing.status == ListingStatus::PartiallyFilled {
                    listings.push_back(listing);
                }
            }
        }

        Ok(listings)
    }

    /// Get listing by ID (read-only).
    pub fn get_listing(env: Env, listing_id: String) -> Result<MarketListing, MarketplaceError> {
        env.storage()
            .persistent()
            .get::<_, MarketListing>(&DataKey::Listing(listing_id))
            .ok_or(MarketplaceError::ListingNotFound)
    }
}
