package com.englishflow.adminops.risk;

import java.util.List;

/** Owner-fact port for the ACCOUNT_LOCKOUT detection rule. */
public interface IamLockoutPort {

    /** Currently locked accounts, newest first. Fail-closed on transport errors. */
    List<LockedAccount> lockedAccounts(String bearer, int limit);
}
