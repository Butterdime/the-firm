/**
 * KYC Routes Aggregator
 * Groups all KYC-related routes
 */

import { Router } from 'express';
import identityRouter from './identity';
import residenceRouter from './residence';
import bankRouter from './bank';
import reportsRouter from './reports';
import reviewRouter from './review';

const router = Router();

// Mount KYC sub-routes
router.use('/', identityRouter);
router.use('/', residenceRouter);
router.use('/', bankRouter);
router.use('/', reportsRouter);
router.use('/', reviewRouter);

export default router;

