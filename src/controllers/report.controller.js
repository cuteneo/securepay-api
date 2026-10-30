const ReportService = require('../services/report.service');
const ApiResponse = require('../utils/apiResponse');

class ReportController {
  static async getDashboard(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const dashboard = await ReportService.getDashboardSummary(req.user.id, { startDate, endDate });
      return ApiResponse.success(res, dashboard, 'Dashboard metrics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getMonthlySummary(req, res, next) {
    try {
      const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
      const monthly = await ReportService.getMonthlySummary(req.user.id, year);
      return ApiResponse.success(res, monthly, 'Monthly breakdown fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportController;
