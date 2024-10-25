use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::whitelist::Whitelist;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct SwapRaydium<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub whitelist: Account<'info, Whitelist>,
    #[account(mut)]
    pub user_source_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_destination_token: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub pool_program_id: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub amm_id: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub amm_authority: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub amm_open_orders: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub amm_target_orders: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub pool_coin_token_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub pool_pc_token_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_program_id: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_market: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_bids: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_asks: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_event_queue: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_coin_vault_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_pc_vault_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub serum_vault_signer: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SwapRaydium>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
    let user = &ctx.accounts.user;
    let whitelist = &ctx.accounts.whitelist;

    require!(whitelist.is_whitelisted(user.key()), ErrorCode::NotWhitelisted);

    let accounts = raydium::accounts::SwapV2 {
        amm_program: ctx.accounts.pool_program_id.to_account_info(),
        amm: ctx.accounts.amm_id.to_account_info(),
        amm_authority: ctx.accounts.amm_authority.to_account_info(),
        amm_open_orders: ctx.accounts.amm_open_orders.to_account_info(),
        amm_target_orders: ctx.accounts.amm_target_orders.to_account_info(),
        pool_coin_token_account: ctx.accounts.pool_coin_token_account.to_account_info(),
        pool_pc_token_account: ctx.accounts.pool_pc_token_account.to_account_info(),
        serum_program: ctx.accounts.serum_program_id.to_account_info(),
        serum_market: ctx.accounts.serum_market.to_account_info(),
        serum_bids: ctx.accounts.serum_bids.to_account_info(),
        serum_asks: ctx.accounts.serum_asks.to_account_info(),
        serum_event_queue: ctx.accounts.serum_event_queue.to_account_info(),
        serum_coin_vault_account: ctx.accounts.serum_coin_vault_account.to_account_info(),
        serum_pc_vault_account: ctx.accounts.serum_pc_vault_account.to_account_info(),
        serum_vault_signer: ctx.accounts.serum_vault_signer.to_account_info(),
        user_source_token_account: ctx.accounts.user_source_token.to_account_info(),
        user_destination_token_account: ctx.accounts.user_destination_token.to_account_info(),
        user_source_owner: ctx.accounts.user.to_account_info(),
        spl_token_program: ctx.accounts.token_program.to_account_info(),
    };

    let swap_instruction = raydium::instruction::swap_v2(
        ctx.accounts.pool_program_id.key,
        &accounts,
        amount_in,
        minimum_amount_out,
    )?;

    anchor_lang::solana_program::program::invoke(
        &swap_instruction,
        &[
            ctx.accounts.pool_program_id.to_account_info(),
            ctx.accounts.amm_id.to_account_info(),
            ctx.accounts.amm_authority.to_account_info(),
            ctx.accounts.amm_open_orders.to_account_info(),
            ctx.accounts.amm_target_orders.to_account_info(),
            ctx.accounts.pool_coin_token_account.to_account_info(),
            ctx.accounts.pool_pc_token_account.to_account_info(),
            ctx.accounts.serum_program_id.to_account_info(),
            ctx.accounts.serum_market.to_account_info(),
            ctx.accounts.serum_bids.to_account_info(),
            ctx.accounts.serum_asks.to_account_info(),
            ctx.accounts.serum_event_queue.to_account_info(),
            ctx.accounts.serum_coin_vault_account.to_account_info(),
            ctx.accounts.serum_pc_vault_account.to_account_info(),
            ctx.accounts.serum_vault_signer.to_account_info(),
            ctx.accounts.user_source_token.to_account_info(),
            ctx.accounts.user_destination_token.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
    )?;

    Ok(())
}