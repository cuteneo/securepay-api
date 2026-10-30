const TransactionService = require('../services/transaction.service');
const ApiResponse = require('../utils/apiResponse');

class TransactionController {
  static async getTransactions(req, res, next) {
    try {
      const { transactions, meta } = await TransactionService.getTransactions(req.user.id, req.query);
      return ApiResponse.success(res, transactions, 'Transactions fetched successfully', 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getTransactionById(req, res, next) {
    try {
      const transaction = await TransactionService.getTransactionById(req.user.id, req.params.id);
      return ApiResponse.success(res, transaction, 'Transaction details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TransactionController;
