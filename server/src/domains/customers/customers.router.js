import { Router } from "express";
import * as service from "./customers.service.js";
import { requireAdminAuth } from "../../shared/middleware/requireAdminAuth.js";

export const customersRouter = Router();

customersRouter.get("/:phone/export", requireAdminAuth, (req, res, next) => {
  try {
    return res.json(service.exportCustomerData(req.params.phone));
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:phone", (req, res, next) => {
  try {
    const customer = service.getCustomerByPhone(req.params.phone);
    const addresses = service.listCustomerAddresses(req.params.phone);
    return res.json({ customer, addresses });
  } catch (error) {
    next(error);
  }
});

customersRouter.delete("/:phone", requireAdminAuth, (req, res, next) => {
  try {
    return res.json(service.deleteCustomerData(req.params.phone));
  } catch (error) {
    next(error);
  }
});
