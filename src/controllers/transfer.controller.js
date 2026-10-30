const TransferService = require('../services/transfer.service');
const ApiResponse = require('../utils/apiResponse');

class TransferController {
  static async transferFunds(req, res, next) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] || null;
      const result = await TransferService.transferFunds(req.user.id, req.body, idempotencyKey);
      
      const message = result.isCached
        ? 'Duplicate transfer request resolved via idempotency cache'
        : 'Funds transferred successfully';

      return ApiResponse.success(res, result, message, 200);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TransferController;
