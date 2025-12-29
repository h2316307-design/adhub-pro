import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PrintSettingsProvider } from "@/store";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Contracts from "./pages/Contracts";
import Tasks from "./pages/Tasks";
import ContractCreate from "./pages/ContractCreate";
import ContractEdit from "./pages/ContractEdit";
import ContractView from "./pages/ContractView";
import Billboards from "./pages/Billboards";
import BillboardCleanup from "./pages/BillboardCleanup";
import BillboardMaintenance from "./pages/BillboardMaintenance";
import Users from "./pages/Users";
import PricingList from "./pages/PricingList";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import Salaries from "./pages/Salaries";
import EmployeeDetail from "./pages/EmployeeDetail";
import Customers from "./pages/Customers";
import CustomerBilling from "./pages/CustomerBilling";
import CustomerMerge from "./pages/CustomerMerge";
import BookingRequests from "./pages/BookingRequests";
import SharedBillboards from "./pages/SharedBillboards";
import SharedCompanies from "./pages/SharedCompanies";
import OverduePayments from "./pages/OverduePayments";
import ExpenseManagement from "./pages/ExpenseManagement";
import PrintedInvoicesPage from "./pages/PrintedInvoicesPage";
import PaymentsReceiptsPage from "./pages/PaymentsReceiptsPage";
import InstallationTeams from "./pages/InstallationTeams";
import InstallationTeamAccounts from "./pages/InstallationTeamAccounts";

import DatabaseBackup from "./pages/DatabaseBackup";
import MessagingSettings from "./pages/MessagingSettings";
import CurrencySettings from "./pages/CurrencySettings";
import Printers from "./pages/Printers";
import InstallationTasks from "./pages/InstallationTasks";
import RemovalTasks from "./pages/RemovalTasks";
import PrintTasks from "./pages/PrintTasks";
import CutoutTasks from "./pages/CutoutTasks";
import PrinterAccounts from "./pages/PrinterAccounts";
import PDFTemplateSettings from "./pages/PDFTemplateSettings";
import FriendBillboards from "./pages/FriendBillboards";
import FriendCompanyAccounts from "./pages/FriendCompanyAccounts";
import CompositeTasks from "./pages/CompositeTasks";
import Revenue from "./pages/Revenue";
import SystemSettings from "./pages/SystemSettings";
import CustodyManagement from "./pages/CustodyManagement";
import OffersPage from "./pages/OffersPage";
import MunicipalityStickers from "./pages/MunicipalityStickers";
import DelayedBillboards from "./pages/DelayedBillboards";
import ExtendedBillboards from "./pages/ExtendedBillboards";
import PricingFactors from "./pages/PricingFactors";

import PrintSettingsPage from "./pages/PrintSettingsPage";
import ContractTermsSettings from "./pages/ContractTermsSettings";
import RolesManagement from "./pages/RolesManagement";
import BillboardPrintSettings from "./pages/BillboardPrintSettings";
import BillboardPrintSettingsNew from "./pages/BillboardPrintSettingsNew";
import QuickPrintSettings from "./pages/QuickPrintSettings";
import { MainLayout } from "@/components/Layout/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <PrintSettingsProvider>
          <Toaster />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/billboards"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Billboards />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/billboard-cleanup"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <BillboardCleanup />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/billboard-maintenance"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <BillboardMaintenance />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Users />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/shared-billboards"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <SharedBillboards />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/shared-companies"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <SharedCompanies />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/friend-billboards"
              element={
                <ProtectedRoute requireAdmin>
                  <FriendBillboards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/friend-accounts"
              element={
                <ProtectedRoute requireAdmin>
                  <FriendCompanyAccounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pricing"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <PricingList />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pricing-factors"
              element={
                <ProtectedRoute requireAdmin>
                  <PricingFactors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Settings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Reports />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Tasks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/expenses"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Expenses />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/salaries"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Salaries />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employees/:id"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <EmployeeDetail />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/custody-management"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <CustodyManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/expense-management"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <ExpenseManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/booking-requests"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <BookingRequests />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Customers />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/overdue-payments"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <OverduePayments />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/customer-merge"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <CustomerMerge />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contracts"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Contracts />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/printed-invoices-page"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <PrintedInvoicesPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/payments-receipts-page"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <PaymentsReceiptsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/installation-teams"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <InstallationTeams />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/installation-team-accounts"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <InstallationTeamAccounts />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/database-backup"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <DatabaseBackup />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/messaging-settings"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <MessagingSettings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/currency-settings"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <CurrencySettings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/printers"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Printers />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/installation-tasks"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <InstallationTasks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/removal-tasks"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <RemovalTasks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/print-tasks"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <PrintTasks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cutout-tasks"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <CutoutTasks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/composite-tasks"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <CompositeTasks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/revenue"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <Revenue />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/printer-accounts"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <PrinterAccounts />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contracts/new"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <ContractCreate />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contracts/edit"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <ContractEdit />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contracts/view/:id"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <ContractView />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pdf-templates"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <PDFTemplateSettings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/offers"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <OffersPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/system-settings"
              element={
                <ProtectedRoute requireAdmin>
                  <SystemSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/municipality-stickers"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <MunicipalityStickers />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/delayed-billboards"
              element={
                <ProtectedRoute requireAdmin>
                  <DelayedBillboards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/extended-billboards"
              element={
                <ProtectedRoute requireAdmin>
                  <ExtendedBillboards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/customer-billing"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <CustomerBilling />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/print-design"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <PrintSettingsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contract-terms"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <ContractTermsSettings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <RolesManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/billboard-print-settings"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <BillboardPrintSettingsNew />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/billboard-print-settings-old"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <BillboardPrintSettings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/quick-print-settings"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <QuickPrintSettings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </PrintSettingsProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
