const WalletService = require('../services/wallet.service');
const ApiResponse = require('../utils/apiResponse');

class WalletController {
  static async getWallet(req, res, next) {
    try {
      const wallet = await WalletService.getWalletByUserId(req.user.id);
      return ApiResponse.success(res, wallet, 'Wallet details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deposit(req, res, next) {
    try {
      const result = await WalletService.deposit(req.user.id, req.body);
      return ApiResponse.success(res, result, 'Funds deposited successfully');
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(req, res, next) {
    try {
      const result = await WalletService.withdraw(req.user.id, req.body);
      return ApiResponse.success(res, result, 'Funds withdrawn successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = WalletController;
