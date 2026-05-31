import { buildRouteMap } from '@stricli/core';
import type { LocalContext } from '../context.ts';
import { cmd0, cmd1 } from './_factory.ts';
import { take } from './_shared.ts';

const companies = cmd0('List insurance companies', {}, ({ client }) =>
  take(client.insurance.getInsuranceCompanies()),
);
const products = cmd0('List all insurance products', {}, ({ client }) =>
  take(client.insurance.getAllProducts()),
);
const companyProducts = cmd1(
  'List products for an insurance company',
  'Company id',
  {},
  ({ client }, id) => take(client.insurance.getInsuranceCompanyProducts(Number(id))),
);
const connectionFields = cmd1(
  'Get connection fields for an insurance company',
  'Company id',
  {},
  ({ client }, id) => take(client.insurance.getCompanyConnectionFields(Number(id))),
);
const resourceKeys = cmd0('List resource keys', {}, ({ client }) =>
  take(client.insurance.getResourceKeys()),
);
const releaseNotes = cmd0('List release notes', {}, ({ client }) =>
  take(client.insurance.getAllReleaseNotes()),
);
const banks = cmd0('List banks', {}, ({ client }) => take(client.insurance.getBanks()));
const bankBranches = cmd1('List branches for a bank', 'Bank id', {}, ({ client }, id) =>
  take(client.insurance.getBankBranches(id)),
);
const financialInstitutions = cmd0('List financial institutions', {}, ({ client }) =>
  take(client.insurance.getFinancialInstitutions()),
);

export const insuranceRoutes = buildRouteMap<string, LocalContext>({
  docs: { brief: 'Insurance reference data (companies, products, banks)' },
  routes: {
    companies,
    products,
    'company-products': companyProducts,
    'connection-fields': connectionFields,
    'resource-keys': resourceKeys,
    'release-notes': releaseNotes,
    banks,
    'bank-branches': bankBranches,
    'financial-institutions': financialInstitutions,
  },
});
