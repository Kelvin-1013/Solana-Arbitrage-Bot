use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use whirlpool::state::Whirlpool;
use crate::state::whitelist::Whitelist;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct SwapWhirlpool<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub whitelist: Account<'info, Whitelist>,
    pub whirlpool_program: Program<'info, whirlpool::program::Whirlpool>,
    #[account(mut)]
    pub whirlpool: Box<Account<'info, Whirlpool>>,
    #[account(mut)]
    pub token_owner_account_a: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub token_owner_account_b: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub token_vault_a: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub token_vault_b: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub tick_array_0: AccountInfo<'info>,
    #[account(mut)]
    pub tick_array_1: AccountInfo<'info>,
    #[account(mut)]
    pub tick_array_2: AccountInfo<'info>,
    #[account(mut)]
    pub oracle: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<SwapWhirlpool>,
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit: u128,
    amount_specified_is_input: bool,
    a_to_b: bool,
) -> Result<()> {
    let user = &ctx.accounts.user;
    let whitelist = &ctx.accounts.whitelist;

    require!(whitelist.is_whitelisted(user.key()), ErrorCode::NotWhitelisted);

    let accounts = whirlpool::cpi::accounts::Swap {
        whirlpool: ctx.accounts.whirlpool.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        token_authority: ctx.accounts.user.to_account_info(),
        token_owner_account_a: ctx.accounts.token_owner_account_a.to_account_info(),
        token_owner_account_b: ctx.accounts.token_owner_account_b.to_account_info(),
        token_vault_a: ctx.accounts.token_vault_a.to_account_info(),
        token_vault_b: ctx.accounts.token_vault_b.to_account_info(),
        tick_array_0: ctx.accounts.tick_array_0.to_account_info(),
        tick_array_1: ctx.accounts.tick_array_1.to_account_info(),
        tick_array_2: ctx.accounts.tick_array_2.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.whirlpool_program.to_account_info(),
        accounts,
    );

    whirlpool::cpi::swap(
        cpi_ctx,
        amount,
        other_amount_threshold,
        sqrt_price_limit,
        amount_specified_is_input,
        a_to_b,
    )?;

    Ok(())
}