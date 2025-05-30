import React, { useState, useContext } from "react";
import { store } from "../../redux/reducer";
import { accountSlice, userAccount } from "../../redux/account";
import { walletSlice } from "../../redux/wallet";
import { LedgerClientFactory, Address } from "@signumjs/core";
import { contractSlice } from "../../redux/contract";
import { profileSlice } from "../../redux/profile";
import { CheckUnconfirmedNewBMIContract, CheckUnconfirmedNewNFTContract } from "../../pages/myNftList/checkNewContract";
import axios from "axios";


export const connectWallet = async (appName: any, Wallet: any, Ledger: any, codeHashId: string, codeHashIdForNft: string, assetId: string) => {
  try {
    let key: string;

    const wallet = await Wallet.Extension.connect({ appName, networkName: Ledger.Network });
    console.log("wallet is",wallet);
    console.log("wallet mode is",wallet.watchOnly);
    if(wallet.watchOnly){
      alert(
        "It looks like you are using the watch only mode. Please import the wallet again using the private key.",
      );
      return null;
    }
    key = wallet.publicKey;
    const import_account: Address = Address.fromPublicKey(key, Ledger.AddressPrefix);
    const accountinfo: userAccount = {
      accountId: import_account.getNumericId(),
      accountRS: import_account.getReedSolomonAddress(),
      publicKey: import_account.getPublicKey(),
      isWatchOnlyMode: true,
      token: 0,
      level: "1",
      nftContractStorage: "",
    };
      const apiAuthToken  = await axios.post( "https://dapp.bettermi.io/api/connectWallet", {
      walletId: accountinfo.accountId,   }
    )
    store.dispatch(accountSlice.actions.setAccount(accountinfo));
    store.dispatch(walletSlice.actions.setWalletPublicKey(key));
    store.dispatch(walletSlice.actions.setIsWalletConnected(true));
    store.dispatch(walletSlice.actions.setWalletNodeHost(wallet.currentNodeHost));
    localStorage.setItem("accountId", import_account.getNumericId());
    localStorage.setItem("nodeHost", wallet.currentNodeHost);
    const ledger = LedgerClientFactory.createClient({ nodeHost: wallet.currentNodeHost });
    console.log("hi");
    // check if there is are unconfirmed NFT and BMI contract
    const openedNftContract = await CheckUnconfirmedNewNFTContract(ledger, import_account.getNumericId());
    const openedBmiContract = await CheckUnconfirmedNewBMIContract(ledger, import_account.getNumericId());

    ledger.asset.getAssetHolders({ assetId: assetId }).then((asset) => {
      for (var i = 0; i < asset.accountAssets.length; i++) {
        if (asset.accountAssets[i].account === accountinfo.accountId) {
          store.dispatch(accountSlice.actions.setToken(Number(asset.accountAssets[i].quantityQNT) / 1000000));
          localStorage.setItem("token", asset.accountAssets[i].quantityQNT);
          break;
        }
        if (i == asset.accountAssets.length - 1) {
          store.dispatch(accountSlice.actions.setToken(0));
          localStorage.setItem("token", "0");
        }
      }
    });
    const asset = await ledger.asset.getAssetHolders({ assetId: assetId });
    asset.accountAssets.map((obj) => {
      if (obj.account == accountinfo.accountId) {
        store.dispatch(accountSlice.actions.setToken(Number(obj.quantityQNT) / 1000000));
        localStorage.setItem("token", obj.quantityQNT);
      }
    });
    // navigate('/connectSucceed');
    let userBMIStorage = await ledger.contract.getContractsByAccount({
      accountId: accountinfo.accountId,
      machineCodeHash: codeHashId.replace(/['"]+/g, ""),
    });
    let userNftStorage = await ledger.contract.getContractsByAccount({
      accountId: accountinfo.accountId,
      machineCodeHash: codeHashIdForNft,
    });
    if (apiAuthToken.data.message === 'Login successful') {
          // setToken(apiAuthTokken.data.token);
        console.log("apiAuthToken created");
    //    const testRequest  = await axios.post( process.env.REACT_APP_NODE_ADDRESS +"/testLimit", 
    //     {
    //       walletId: accountinfo.accountId,   
    //     }, {
    //       withCredentials: true // Ensures cookies (including HTTP-only JWT) are sent
    //   }
    // )
    // console.log("testRequest is",testRequest);
    }else { 
      alert("Failed to connect wallet, please try again later.");
      return null;
    }
    // set the redux for if needed to recreate the BMI and NFT contract
    store.dispatch(contractSlice.actions.setIsBMIContractBuild(typeof userBMIStorage.ats[0] !== "undefined" || openedBmiContract === true));
    store.dispatch(contractSlice.actions.setIsNFTContractBuild(typeof userNftStorage.ats[0] !== "undefined" || openedNftContract === true));
    return { userNftStorage: userNftStorage, userBMIStorage: userBMIStorage, openedBmiContract: openedBmiContract, openedNftContract: openedNftContract, userPublicKey: key, loginedAcctID: accountinfo.accountId,ledger:ledger};
  } catch (error: any) {
    // todo: add error handling, and show it to user
    console.log(error);
    if (error.name === "InvalidNetworkError") {
      alert(
        "It looks like you are not connecting to the correct signum node in your XT-Wallet, currently in our beta version we are using Europe node, please change your node to Europe node and try again",
      );
      return null;
    }
    if (error.name === "NotFoundWalletError") {
      window.location.href = "https://chrome.google.com/webstore/detail/signum-xt-wallet/kdgponmicjmjiejhifbjgembdcaclcib/";
      return null;
    }
  }
};
